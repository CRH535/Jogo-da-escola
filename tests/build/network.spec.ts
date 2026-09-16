import { expect, test } from '@playwright/test';

test('production serves two LAN clients through one port without Vite or debug payloads', async ({ page, browser }, info) => {
  const context = await browser.newContext(); const other = await context.newPage(); const errors: string[] = [];
  for (const p of [page, other]) p.on('pageerror', (error) => errors.push(error.message));
  try {
    for (const [p, name] of [[page, 'Chris'], [other, 'Lucas']] as const) {
      await p.goto('/#multiplayer'); await p.getByLabel('Nome do jogador').fill(name);
      await expect(p.getByLabel('Endereço do servidor')).toHaveValue('http://127.0.0.1:3101');
      if (p === page) {
        await p.getByRole('button', { name: 'CRIAR PARTIDA', exact: true }).click();
        await p.getByRole('button', { name: 'CRIAR SERVIDOR/SALA', exact: true }).click();
      } else await p.getByRole('button', { name: 'CONECTAR', exact: true }).click();
      await expect(p.getByLabel('Estado da rede')).toHaveAttribute('data-state', 'connected', { timeout: 20000 });
      await expect(p.getByLabel('Debug do jogador')).toHaveCount(0);
      expect(await p.getByLabel('Estado da rede').getAttribute('data-players')).toBeNull();
      expect(await p.getByLabel('Estado da rede').getAttribute('data-tick')).toBeNull();
    }
    await expect(page.getByLabel('Jogadores conectados')).toHaveText('2');
    await other.getByRole('button', { name: 'PRONTO', exact: true }).click();
    await page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true }).click();
    await expect(page.getByLabel('Estado do combate online')).toHaveAttribute('data-match-state', 'PLAYING');
    await page.bringToFront(); await page.getByRole('button', { name: 'ENTRAR NA ARENA' }).click();
    await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
    await page.keyboard.down('w'); await page.waitForTimeout(1200); await page.keyboard.up('w');
    await page.mouse.down(); await page.waitForTimeout(200); await page.mouse.up();
    await expect.poll(async () => Number(await page.getByLabel('Estado do combate online').getAttribute('data-magazine'))).toBeLessThan(30);
    await page.keyboard.down('Tab'); const board = page.getByRole('region', { name: 'Placar', exact: true });
    await expect(board.locator('tbody tr')).toHaveCount(2); await expect(board).toContainText('Lucas');
    await expect(page.getByLabel('Ping', { exact: true })).toContainText('ms');
    await page.screenshot({ path: info.outputPath('compiled-lan.png') });
    await page.keyboard.up('Tab'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'DESCONECTAR' }).click();
    await expect(other.locator('.network-status')).toHaveText('SALA ENCERRADA: O HOST SAIU');
    await other.getByRole('button', { name: 'DESCONECTAR' }).click();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
