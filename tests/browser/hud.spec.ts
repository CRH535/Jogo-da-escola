import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'node:url';

const state = (page: Page) => page.getByLabel('Estado do treinamento');
const value = async (page: Page, name: string) => Number(await state(page).getAttribute(`data-${name}`));
const debug = async (page: Page, name: string) => Number(await page.getByLabel('Diagnóstico do jogador').getAttribute(`data-${name}`));
async function ready(page: Page, name = 'Chris', diagnostics = false) {
  await page.goto('/#play'); await page.getByLabel('Nome do jogador').fill(name);
  await page.getByRole('button', { name: 'Voltar ao menu', exact: true }).click();
  await page.getByRole('button', { name: 'TREINAMENTO', exact: true }).click();
  await page.getByRole('button', { name: 'INICIAR TREINAMENTO' }).click();
  await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible({ timeout: 20000 });
  if (diagnostics) await page.getByLabel('Debug do jogador').check();
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 640 }]) {
  test(`test-only eight-row scoreboard renders sorted data and a remaining-time snapshot at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); await ready(page); await enter(page);
    const path = fileURLToPath(new URL('../fixtures/hudFixture.tsx', import.meta.url)).replaceAll('\\', '/');
    await page.evaluate(async (url) => { const fixture = await import(url); fixture.mountFixture(); }, `/@fs/${path}`);
    const fixture = page.getByTestId('hud-fixture'); const board = fixture.getByRole('region', { name: 'Placar', exact: true });
    await expect(board.locator('tbody tr')).toHaveCount(8);
    expect(await board.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-player-id')))).toEqual(['fixture-5', 'fixture-1', 'fixture-6', 'fixture-2', 'fixture-7', 'fixture-3', 'fixture-0', 'fixture-4']);
    await expect(fixture.getByLabel('Tempo restante')).toHaveText('09:37'); await expect(fixture.getByLabel('Quantidade de jogadores')).toHaveText('8');
    await expect(board.locator('[data-player-id="fixture-0"]')).toContainText('<b>Chris</b>'); await expect(board.locator('b')).toHaveCount(0);
    await expect(board.locator('[data-player-id="fixture-4"] .score-ping')).toHaveText('--');
    await page.screenshot({ path: testInfo.outputPath('eight-row-scoreboard-fixture.png') });
    expect(await board.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    const overflow = await board.locator('th, td, .score-name').evaluateAll((cells) => cells.filter((cell) => cell.scrollWidth > cell.clientWidth + 1).map((cell) => cell.textContent));
    expect(overflow).toEqual([]);
  });
}
async function enter(page: Page, name = 'ENTRAR NA ARENA') {
  await page.getByRole('button', { name, exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
}
async function kill(page: Page) {
  await page.mouse.down(); await expect.poll(() => value(page, 'eliminations'), { intervals: [50] }).toBe(1); await page.mouse.up();
}
async function pause(page: Page) {
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeVisible();
}

test('HUD counts real eliminations, displays the timer and one player, and TAB does not pause or unlock the mouse', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 }); await ready(page, 'Chris', true);
  expect(await value(page, 'time')).toBe(0); await enter(page);
  await expect(page.getByLabel('Quantidade de jogadores')).toHaveText('1');
  await expect(page.getByLabel('Pontuação', { exact: true })).toHaveText('0');
  await kill(page);
  await expect(page.getByLabel('Pontuação', { exact: true })).toHaveText('100');
  await expect(page.getByLabel('Feed de eliminações').getByRole('listitem')).toHaveCount(1);
  await expect(page.getByLabel('Feed de eliminações')).toContainText('Chris');
  await expect(page.getByLabel('Feed de eliminações')).toContainText('T-01');
  await page.screenshot({ path: testInfo.outputPath('hud-elimination.png') });
  await page.keyboard.down('Tab');
  const board = page.getByRole('region', { name: 'Placar', exact: true });
  await expect(board).toBeVisible();
  for (const name of ['JOGADOR', 'ELIMINAÇÕES', 'DERROTAS', 'PONTUAÇÃO', 'PING']) await expect(board.getByRole('columnheader', { name, exact: true })).toBeVisible();
  await expect(board.locator('tbody tr')).toHaveCount(1);
  await expect(board.locator('tbody tr')).toContainText('Chris');
  await expect(board.locator('tbody td')).toHaveText(['1', '0', '100', 'LOCAL']);
  await expect(page.locator('.fps-reticle')).toHaveCount(0);
  const before = await debug(page, 'z'); const time = await value(page, 'time');
  await page.keyboard.down('w'); await expect.poll(() => debug(page, 'z')).toBeLessThan(before - 1); await page.keyboard.up('w');
  await expect.poll(() => value(page, 'time')).toBeGreaterThan(time);
  await page.screenshot({ path: testInfo.outputPath('scoreboard.png') });
  expect(await page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
  await page.keyboard.up('Tab'); await expect(board).toHaveCount(0); await expect(page.locator('.fps-reticle')).toBeVisible();
  await pause(page); await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  await expect(page.getByText('Renderização ativa')).toBeVisible(); expect(errors).toEqual([]);
});

test('pause freezes feed expiry and timer, expiry does not erase score and restart clears the session', async ({ page }) => {
  await ready(page); await enter(page); await kill(page); await pause(page);
  const time = await value(page, 'time');
  await page.waitForTimeout(5200); expect(await value(page, 'time')).toBe(time); expect(await value(page, 'score')).toBe(100);
  await enter(page, 'CONTINUAR'); await expect(page.getByLabel('Feed de eliminações').getByRole('listitem')).toHaveCount(1);
  await expect(page.getByLabel('Feed de eliminações').getByRole('listitem')).toHaveCount(0, { timeout: 6500 });
  expect(await value(page, 'score')).toBe(100);
  await pause(page); await page.getByRole('button', { name: 'REINICIAR', exact: true }).click();
  await expect.poll(() => value(page, 'score')).toBe(0); expect(await value(page, 'deaths')).toBe(0);
  expect(await value(page, 'time')).toBe(0); await expect(page.getByLabel('Feed de eliminações').getByRole('listitem')).toHaveCount(0);
});

test('TAB remains usable during elimination and respawn, and defeats retain previous score', async ({ page }, testInfo) => {
  await ready(page, 'Chris', true); await enter(page); await kill(page);
  await page.keyboard.down('w'); await expect.poll(() => debug(page, 'z'), { intervals: [50] }).toBeLessThan(1.5); await page.keyboard.up('w');
  await expect.poll(() => value(page, 'hp')).toBe(0);
  await expect(page.getByLabel('Feed de eliminações')).toContainText('Campo de energia');
  await page.keyboard.down('Tab');
  const board = page.getByRole('region', { name: 'Placar', exact: true });
  await expect(board).toBeVisible(); await expect(board).toContainText('RESPAWN EM');
  await expect(board.locator('tbody td')).toHaveText(['1', '1', '100', 'LOCAL']);
  await page.screenshot({ path: testInfo.outputPath('scoreboard-respawn.png') });
  await expect.poll(() => value(page, 'hp')).toBe(100);
  await expect(board).toBeVisible(); await expect(board).toContainText('SESSÃO LOCAL');
  await expect(board.locator('tbody td')).toHaveText(['1', '1', '100', 'LOCAL']);
  await page.keyboard.up('Tab'); await expect(board).toHaveCount(0);
});

test('ESC, blur and context loss close the scoreboard while TAB remains normal keyboard navigation in menus', async ({ page }) => {
  await ready(page); await enter(page); await page.keyboard.down('Tab');
  const board = page.getByRole('region', { name: 'Placar', exact: true }); await expect(board).toBeVisible();
  await pause(page); await expect(board).toHaveCount(0); await page.keyboard.up('Tab');
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'CONFIGURAÇÕES', exact: true })).toBeFocused();
  await enter(page, 'CONTINUAR'); await expect(board).toHaveCount(0);
  await page.keyboard.down('Tab'); await expect(board).toBeVisible(); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeVisible(); await expect(board).toHaveCount(0);
  await page.keyboard.up('Tab'); await enter(page, 'CONTINUAR'); await page.keyboard.down('Tab'); await expect(board).toBeVisible();
  await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
  await expect(page.getByRole('alert')).toContainText('Não foi possível manter a cena 3D'); await expect(board).toHaveCount(0);
  await page.keyboard.up('Tab'); await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  await expect(page.getByText('Renderização ativa')).toBeVisible();
});

test('reload progress is bounded, low ammo is visible and fresh entry starts with fresh statistics', async ({ page }) => {
  await ready(page); await enter(page);
  await page.mouse.down(); await expect.poll(() => value(page, 'magazine'), { intervals: [50] }).toBeLessThanOrEqual(6); await page.mouse.up();
  await expect(page.getByText('CARGA BAIXA', { exact: true })).toBeVisible(); await page.keyboard.press('r');
  const progress = page.getByRole('progressbar', { name: 'Progresso da recarga' });
  await expect(progress).toBeVisible();
  const initial = Number(await progress.getAttribute('value'));
  await expect.poll(async () => Number(await progress.getAttribute('value'))).toBeGreaterThan(initial);
  await expect.poll(() => value(page, 'magazine')).toBe(30); await expect(progress).toHaveCount(0);
  await page.keyboard.down('Tab'); await expect(page.getByRole('region', { name: 'Placar', exact: true })).toBeVisible();
  await pause(page); await page.keyboard.up('Tab'); await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  await page.getByRole('button', { name: 'TREINAMENTO', exact: true }).click(); await page.getByRole('button', { name: 'INICIAR TREINAMENTO' }).click();
  await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible({ timeout: 20000 }); await enter(page);
  await expect(page.getByRole('region', { name: 'Placar', exact: true })).toHaveCount(0);
  expect(await value(page, 'score')).toBe(0); expect(await value(page, 'deaths')).toBe(0);
  await expect(page.getByLabel('Feed de eliminações').getByRole('listitem')).toHaveCount(0);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 800, height: 600 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`HUD and scoreboard fit long player names at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); await ready(page, 'ABCDEFGHIJKLMNOPQRST'); await enter(page); await kill(page);
    const png = PNG.sync.read(await page.screenshot({ path: testInfo.outputPath('hud.png') }));
    let lit = 0;
    for (let i = 0; i < png.data.length; i += 4) if (png.data[i]! > 60 || png.data[i + 1]! > 65) lit++;
    expect(lit).toBeGreaterThan(viewport.width * viewport.height * 0.15);
    const summary = (await page.getByLabel('Resumo da sessão').boundingBox())!;
    const feed = (await page.getByLabel('Feed de eliminações').boundingBox())!;
    expect(summary.y + summary.height).toBeLessThan(feed.y);
    await page.keyboard.down('Tab'); await expect(page.getByRole('region', { name: 'Placar', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('scoreboard.png') });
    const board = (await page.getByRole('region', { name: 'Placar', exact: true }).boundingBox())!;
    const bottom = (await page.locator('.combat-bottom').boundingBox())!;
    expect(board.y).toBeGreaterThan(summary.y + summary.height); expect(board.y + board.height).toBeLessThan(bottom.y);
    const overflow = await page.locator('.hud-summary, .hud-scoreboard, .hud-scoreboard th, .hud-scoreboard td, .score-name').evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent));
    expect(overflow).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.up('Tab');
  });
}
