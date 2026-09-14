import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const combat = (page: Page) => page.getByLabel('Estado do combate');
const value = async (page: Page, key: string) => Number(await combat(page).getAttribute(`data-${key}`));
const debug = (page: Page) => page.getByLabel('Diagnóstico do jogador');
const botData = async (page: Page): Promise<{ id: string; x: number; y: number; z: number; hp: number; state: string }[]> => JSON.parse(await debug(page).getAttribute('data-bots') || '[]');
async function ready(page: Page, count = 7, difficulty = 'normal') {
  await page.goto('/#play');
  await page.getByLabel('Nome do jogador').fill('Chris');
  await page.getByLabel('Número de bots').selectOption(String(count));
  await page.getByLabel('Dificuldade').selectOption(difficulty);
  await page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible({ timeout: 20000 });
  await page.getByLabel('Debug do jogador').check();
}
async function enter(page: Page, label = 'ENTRAR NA ARENA') {
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
  if (await combat(page).count()) await expect(combat(page)).toHaveAttribute('data-match-state', 'PLAYING');
}
async function pause(page: Page) {
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeVisible();
}

for (const [count, difficulty] of [[1, 'easy'], [3, 'normal'], [7, 'hard']] as const) {
  test(`menu starts ${count} real bots at ${difficulty}, reload keeps setup and back returns keyboard focus`, async ({ page }) => {
    await ready(page, count, difficulty);
    await expect.poll(async () => (await botData(page)).length).toBe(count);
    await page.getByRole('button', { name: 'VOLTAR A JOGAR', exact: true }).click();
    await expect(page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true })).toBeFocused();
    await page.reload(); await expect(page.getByLabel('Número de bots')).toHaveValue(String(count));
    await expect(page.getByLabel('Dificuldade')).toHaveValue(difficulty);
    await page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true }).click(); await enter(page);
    await expect(page.getByLabel('Quantidade de jogadores')).toHaveText(String(count + 1));
    await page.keyboard.down('Tab');
    const board = page.getByRole('region', { name: 'Placar', exact: true });
    await expect(board.locator('tbody tr')).toHaveCount(count + 1);
    await expect(board.locator('[data-local="true"] .score-ping')).toHaveText('LOCAL');
    await expect(board.locator('[data-local="false"] .score-ping')).toHaveText(Array(count).fill('BOT'));
    await page.keyboard.up('Tab'); await pause(page);
    await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
    await expect(page.getByRole('button', { name: 'JOGAR', exact: true })).toBeFocused();
  });
}

test('real shooting eliminates an initial bot, feed and score agree, and reset restores all actors', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await ready(page, 7, 'easy');
  const entry = await page.getByRole('button', { name: 'ENTRAR NA ARENA' }).boundingBox();
  await enter(page);
  // Aim at the torso, not the edge of a moving head capsule; weapon spread stays enabled.
  await page.mouse.move(entry!.x + entry!.width / 2, entry!.y + entry!.height / 2 + 7);
  await page.mouse.down();
  await expect.poll(() => value(page, 'score'), { timeout: 6000, intervals: [50] }).toBeGreaterThanOrEqual(100);
  await page.mouse.up();
  await expect(page.getByLabel('Feed de eliminações')).toContainText('Chris');
  await expect(page.getByLabel('Feed de eliminações')).toContainText('BOT-07');
  await page.screenshot({ path: testInfo.outputPath('bot-elimination.png') });
  await pause(page);
  await page.getByRole('button', { name: 'REINICIAR', exact: true }).click();
  await expect(combat(page)).toHaveAttribute('data-score', '0'); await expect(combat(page)).toHaveAttribute('data-hp', '100');
  await expect(combat(page)).toHaveAttribute('data-magazine', '30');
  await page.keyboard.down('Tab');
  await expect(page.getByRole('region', { name: 'Placar', exact: true }).locator('.score-points')).toHaveText(Array(8).fill('0'));
  await page.keyboard.up('Tab'); await pause(page); await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  expect(errors).toEqual([]);
});

test('seven bots move and fight while TAB stays open; pause freezes their poses, HP and session time', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await ready(page); const before = await botData(page); await enter(page);
  await expect.poll(async () => (await botData(page)).filter((bot, index) => Math.hypot(bot.x - before[index]!.x, bot.z - before[index]!.z) > 1).length).toBeGreaterThan(4);
  await page.keyboard.down('Tab');
  const board = page.getByRole('region', { name: 'Placar', exact: true });
  await expect.poll(async () => (await board.locator('.score-points').allTextContents()).some((score) => Number(score) > 0), { timeout: 40000 }).toBe(true);
  expect(await page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
  await page.screenshot({ path: testInfo.outputPath('bots-live-scoreboard.png') });
  await page.keyboard.up('Tab'); await pause(page);
  const frozen = await botData(page); const hp = await value(page, 'hp'); const time = await value(page, 'time');
  await page.waitForTimeout(1600);
  expect(await botData(page)).toEqual(frozen); expect(await value(page, 'hp')).toBe(hp); expect(await value(page, 'time')).toBe(time);
  await enter(page, 'CONTINUAR'); await expect.poll(() => value(page, 'time')).toBeLessThan(time);
});

test('bots can eliminate the idle human and respawn restores life, pose, input and an unchanged scoreboard', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await ready(page, 7, 'hard'); await enter(page);
  await expect.poll(() => value(page, 'hp'), { timeout: 65000, intervals: [100] }).toBe(0);
  const deaths = await value(page, 'deaths'); expect(deaths).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'VOCÊ FOI ELIMINADO' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('human-eliminated.png') });
  await page.keyboard.down('Tab'); await pause(page); await page.keyboard.up('Tab');
  await page.waitForTimeout(3300); expect(await value(page, 'hp')).toBe(0);
  await enter(page, 'CONTINUAR'); await page.keyboard.down('Tab');
  await expect.poll(() => value(page, 'hp'), { timeout: 4500, intervals: [50] }).toBe(100);
  expect(await value(page, 'deaths')).toBe(deaths);
  await expect(page.getByRole('region', { name: 'Placar', exact: true })).toBeVisible();
  const pose = await debug(page).evaluate((element) => ({ x: Number(element.getAttribute('data-x')), y: Number(element.getAttribute('data-y')), z: Number(element.getAttribute('data-z')) }));
  expect(Math.abs(pose.x)).toBeLessThan(24); expect(pose.y).toBeGreaterThanOrEqual(0); expect(Math.abs(pose.z)).toBeLessThan(20);
  await page.keyboard.up('Tab'); await page.mouse.down(); await expect.poll(() => value(page, 'magazine')).toBeLessThan(30); await page.mouse.up();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`bot scene and eight-row real scoreboard render at ${viewport.width}x${viewport.height} without overlap`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); await ready(page); await enter(page);
    const first = PNG.sync.read(await page.screenshot());
    await expect.poll(async () => {
      const next = PNG.sync.read(await page.screenshot()); let changed = 0;
      for (let y = Math.floor(next.height * 0.35); y < next.height * 0.8; y++) for (let x = 0; x < next.width; x++) {
        const i = (y * next.width + x) * 4;
        if (Math.abs(first.data[i]! - next.data[i]!) > 20) changed++;
      }
      return changed;
    }).toBeGreaterThan(50);
    const diagnostics = await debug(page).boundingBox(); const health = await page.locator('.combat-health').boundingBox();
    expect(diagnostics!.y + diagnostics!.height).toBeLessThan(health!.y);
    await page.screenshot({ path: testInfo.outputPath('bots-gameplay.png') });
    await page.keyboard.down('Tab');
    const board = page.getByRole('region', { name: 'Placar', exact: true }); await expect(board.locator('tbody tr')).toHaveCount(8);
    await page.screenshot({ path: testInfo.outputPath('bots-scoreboard.png') });
    const bounds = await board.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(await board.locator('th, td').evaluateAll((cells) => cells.filter((cell) => cell.scrollWidth > cell.clientWidth + 1).map((cell) => cell.textContent))).toEqual([]);
  });
}

test('leaving bots repeatedly restores a single context and leaves training and exploration isolated', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  for (let i = 0; i < 3; i++) {
    await ready(page, 3); await enter(page); await pause(page);
    const canvas = await page.locator('canvas').elementHandle();
    await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
    expect(await canvas!.evaluate((element) => (element as HTMLCanvasElement).getContext('webgl2')?.isContextLost())).toBe(true);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.getByText('Renderização ativa')).toBeVisible();
  }
  await page.getByRole('button', { name: 'TREINAMENTO', exact: true }).click(); await page.getByRole('button', { name: 'INICIAR TREINAMENTO' }).click();
  await enter(page); await expect(page.getByLabel('Quantidade de jogadores')).toHaveText('1');
  await page.keyboard.down('Tab'); await expect(page.getByRole('region', { name: 'Placar', exact: true }).locator('tbody tr')).toHaveCount(1);
  await page.keyboard.up('Tab'); await pause(page); await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  await page.getByRole('button', { name: 'JOGAR', exact: true }).click(); await page.getByRole('button', { name: 'EXPLORAR ARENA' }).click();
  // Many rapid captures may hit Chrome's rate limit; recovery must require a new user gesture.
  await page.getByRole('button', { name: 'ENTRAR NA ARENA' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.pointerLockElement || document.querySelector('[role="alert"]')))).toBe(true);
  if (await page.getByRole('alert').isVisible()) {
    await expect(page.getByRole('alert')).toContainText('Aguarde alguns segundos');
    await expect(page.locator('.fps-screen')).toHaveAttribute('data-player-status', 'ready');
    await page.waitForTimeout(5000); await enter(page);
  }
  expect(await page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
  await expect(page.locator('.combat-readout')).toHaveCount(0); expect(errors).toEqual([]);
});
