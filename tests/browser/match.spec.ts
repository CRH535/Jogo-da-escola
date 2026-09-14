import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const combat = (page: Page) => page.getByLabel('Estado do combate');
async function ready(page: Page, fixture?: 'time' | 'kill') {
  await page.goto('/#play');
  await page.getByLabel('Nome do jogador').fill('ABCDEFGHIJKLMNOPQRST');
  await page.getByLabel('Número de bots').selectOption('7');
  await page.getByLabel('Dificuldade').selectOption('easy');
  if (fixture) {
    const path = fileURLToPath(new URL('../fixtures/match.html', import.meta.url)).replaceAll('\\', '/');
    await page.goto(`/@fs/${path}?finish=${fixture}`);
  } else await page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible({ timeout: 20000 });
}
async function enter(page: Page, label = 'ENTRAR NA ARENA') {
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
}

test('real default countdown blocks queued movement, shots and equipment, pauses and resumes without spending match time', async ({ page }, testInfo) => {
  await ready(page); await page.getByLabel('Debug do jogador').check();
  const debug = page.getByLabel('Diagnóstico do jogador');
  const original = await debug.getAttribute('data-bots'); const x = await debug.getAttribute('data-x'); const z = await debug.getAttribute('data-z');
  await enter(page);
  await expect(page.getByLabel('Contagem inicial')).toContainText('3');
  await page.keyboard.down('w'); await page.keyboard.down('Space'); await page.keyboard.press('2'); await page.mouse.down();
  await page.waitForTimeout(250); await page.screenshot({ path: testInfo.outputPath('countdown.png') });
  expect(await debug.getAttribute('data-bots')).toBe(original);
  expect(await debug.getAttribute('data-x')).toBe(x); expect(await debug.getAttribute('data-z')).toBe(z);
  await expect(combat(page)).toHaveAttribute('data-magazine', '30'); await expect(combat(page)).toHaveAttribute('data-selected', '0');
  await page.keyboard.press('Escape'); await page.keyboard.up('w'); await page.keyboard.up('Space'); await page.mouse.up();
  const state = await combat(page).getAttribute('data-match-state');
  await page.waitForTimeout(3300); await expect(combat(page)).toHaveAttribute('data-match-state', state!);
  await expect(combat(page)).toHaveAttribute('data-time', '600');
  await enter(page, 'CONTINUAR');
  await expect(page.getByLabel('Contagem inicial')).toContainText('2');
  await expect(page.getByLabel('Contagem inicial')).toContainText('1');
  await expect(page.getByLabel('Contagem inicial')).toContainText('GO!');
  await expect(combat(page)).toHaveAttribute('data-match-state', 'PLAYING');
  await expect(combat(page)).toHaveAttribute('data-magazine', '30');
  await expect(page.getByLabel('Tempo restante')).toHaveText('09:59');
  await expect(page.getByLabel('Contagem inicial')).toHaveCount(0);
  await page.keyboard.down('w'); await expect.poll(async () => Number(await debug.getAttribute('data-z'))).toBeLessThan(Number(z) - 0.5); await page.keyboard.up('w');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'REINICIAR', exact: true }).click();
  await expect(combat(page)).toHaveAttribute('data-match-state', 'COUNTDOWN'); await expect(combat(page)).toHaveAttribute('data-time', '600');
});

test('real match runtime reaches victory from mouse shots, releases the pointer and restarts without stale state or contexts', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await ready(page, 'kill');
  const box = await page.getByRole('button', { name: 'ENTRAR NA ARENA' }).boundingBox();
  await enter(page); await expect(combat(page)).toHaveAttribute('data-match-state', 'PLAYING');
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 7);
  await page.mouse.down();
  const result = page.getByLabel('Resultado da partida');
  await expect(result).toHaveAttribute('data-outcome', 'victory', { timeout: 6000 }); await page.mouse.up();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect(page.getByRole('dialog', { name: 'Fim da partida' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'JOGAR NOVAMENTE' })).toBeFocused();
  await expect(result.locator('tbody tr')).toHaveCount(8); await expect(result.locator('.match-metrics')).toContainText('100');
  await expect(result).toContainText('LIMITE DE ELIMINAÇÕES');
  const frozen = await result.textContent(); const ammo = await combat(page).getAttribute('data-magazine');
  await page.keyboard.press('Escape'); await page.keyboard.press('r'); await page.keyboard.press('w');
  await page.waitForTimeout(3400); expect(await result.textContent()).toBe(frozen); await expect(combat(page)).toHaveAttribute('data-magazine', ammo!);
  await page.screenshot({ path: testInfo.outputPath('victory.png') });
  const canvas = await page.locator('canvas').elementHandle();
  await page.getByRole('button', { name: 'JOGAR NOVAMENTE' }).click();
  await expect(combat(page)).toHaveAttribute('data-match-state', 'COUNTDOWN');
  await expect(combat(page)).toHaveAttribute('data-hp', '100'); await expect(combat(page)).toHaveAttribute('data-magazine', '30'); await expect(combat(page)).toHaveAttribute('data-score', '0');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await canvas!.evaluate((el) => (el as HTMLCanvasElement).getContext('webgl2')?.isContextLost())).toBe(false);
  await expect(combat(page)).toHaveAttribute('data-match-state', 'PLAYING');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  await expect(page.getByRole('heading', { name: 'MENU DA FIXTURE' })).toBeVisible();
  expect(await canvas!.evaluate((el) => (el as HTMLCanvasElement).getContext('webgl2')?.isContextLost())).toBe(true); expect(errors).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`time-limit defeat shows a readable final eight-row table and menu at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewportSize(viewport); await ready(page, 'time'); await enter(page);
    await expect(page.getByLabel('Tempo restante')).toHaveText('00:02');
    await expect(combat(page)).toHaveAttribute('data-match-state', 'PLAYING');
    await page.keyboard.down('Tab');
    await expect(page.getByLabel('Resultado da partida')).toHaveAttribute('data-outcome', 'defeat', { timeout: 6000 }); await page.keyboard.up('Tab');
    await expect(combat(page)).toHaveAttribute('data-time', '0'); await expect(page.getByRole('heading', { name: 'PAUSA' })).toHaveCount(0);
    await expect(page.getByLabel('Resultado da partida')).toContainText('TEMPO ESGOTADO');
    await expect(page.getByLabel('Resultado da partida').locator('tbody tr')).toHaveCount(8);
    const dialog = page.getByRole('dialog', { name: 'Fim da partida' });
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (viewport.width > 800) expect(bounds!.width).toBeGreaterThanOrEqual(800);
    expect(await dialog.locator('th, td, button, dt, dd').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent))).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('time-limit-results.png') });
    await page.getByRole('button', { name: 'MENU PRINCIPAL' }).click();
    await expect(page.getByRole('heading', { name: 'MENU DA FIXTURE' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
