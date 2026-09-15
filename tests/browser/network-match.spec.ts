import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createMovementNetwork } from '../../server/src/network/createMovementNetwork';

test('server time ends both clients, releases pointer lock and begins the next round without a client restart', async ({ page, browser }, info) => {
  test.setTimeout(60000);
  // Short rules belong to this isolated server fixture, never to URL/localStorage inputs.
  const http = createServer();
  const network = await createMovementNetwork(http, { mode: 'ffa', countdownTicks: 180, durationTicks: 480, eliminationLimit: 30 });
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const address = http.address(); if (!address || typeof address === 'string') throw new Error('No fixture port');
  const context = await browser.newContext(); const other = await context.newPage();
  const errors: string[] = []; for (const p of [page, other]) p.on('pageerror', (e) => errors.push(e.message));
  try {
    for (const [p, name] of [[page, 'Chris'], [other, 'Lucas']] as const) {
      await p.goto('/#multiplayer'); await p.getByLabel('Nome do jogador').fill(name);
      await p.getByLabel('Endereço do servidor').fill(`http://127.0.0.1:${address.port}`);
      await p.getByRole('button', { name: 'CONECTAR', exact: true }).click();
      await expect(p.getByLabel('Estado da rede')).toHaveAttribute('data-state', 'connected', { timeout: 20000 });
    }
    await page.bringToFront(); await page.getByRole('button', { name: 'ENTRAR NA ARENA' }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.pointerLockElement))).toBe(true);
    await expect(page.getByLabel('Estado do combate online')).toHaveAttribute('data-match-state', 'PLAYING');
    await page.mouse.down(); await page.waitForTimeout(200); await page.mouse.up();
    for (const p of [page, other]) {
      await expect(p.getByRole('dialog', { name: 'Fim da partida' })).toBeVisible({ timeout: 12000 });
      await expect(p.getByLabel('Resultado da partida')).toContainText('TEMPO ESGOTADO');
      await expect(p.getByLabel('Resultado da partida').locator('tbody tr')).toHaveCount(2);
      await expect(p.getByRole('button', { name: /PRÓXIMA PARTIDA:/ })).toBeDisabled();
      await expect.poll(() => p.evaluate(() => document.pointerLockElement === null)).toBe(true);
    }
    await page.screenshot({ path: info.outputPath('online-match-end.png') });
    const winner = await page.getByLabel('Resultado da partida').getAttribute('data-outcome');
    expect(await other.getByLabel('Resultado da partida').getAttribute('data-outcome')).not.toBe(winner);
    await expect(page.getByRole('dialog', { name: 'Fim da partida' })).toHaveCount(0, { timeout: 17000 });
    await expect(page.locator('.fps-screen')).toHaveAttribute('data-player-status', 'ready');
    await expect(page.getByLabel('Estado do combate online')).toHaveAttribute('data-magazine', '30');
    await expect(page.getByLabel('Estado do combate online')).toHaveAttribute('data-score', '0');
    await page.getByRole('button', { name: 'ENTRAR NA ARENA' }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.pointerLockElement))).toBe(true);
    await expect(page.getByLabel('Estado do combate online')).toHaveAttribute('data-match-state', 'PLAYING');
    expect(errors).toEqual([]);
  } finally { await context.close(); await page.goto('/'); await network.close(); }
});
