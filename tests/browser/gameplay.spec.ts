import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const readout = (page: Page) => page.getByLabel('Estado do treinamento');
const stat = async (page: Page, name: string) => Number(await readout(page).getAttribute(`data-${name}`));
async function ready(page: Page, debug = false) {
  await page.goto('/#training');
  await page.getByRole('button', { name: 'INICIAR TREINAMENTO' }).click();
  await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible({ timeout: 20000 });
  if (debug) await page.getByLabel('Debug do jogador').check();
}
async function enter(page: Page, name = 'ENTRAR NA ARENA') {
  await page.getByRole('button', { name, exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
}
async function pause(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeVisible();
}
async function debugValue(page: Page, name: string) {
  return Number(await page.getByLabel('Diagnóstico do jogador').getAttribute(`data-${name}`));
}

test('training fires real eye rays, consumes ammunition, hits, eliminates and reloads', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page); await enter(page);
  await expect.poll(() => stat(page, 'hp')).toBe(100);
  await expect.poll(() => stat(page, 'magazine')).toBe(30);
  await page.screenshot({ path: testInfo.outputPath('training-start.png') });
  await page.mouse.down();
  await expect.poll(() => stat(page, 'eliminations'), { intervals: [50] }).toBeGreaterThan(0);
  await page.mouse.up();
  await expect.poll(() => stat(page, 'hits')).toBeGreaterThanOrEqual(5);
  const ammo = await stat(page, 'magazine');
  expect(ammo).toBeLessThanOrEqual(25);
  await page.screenshot({ path: testInfo.outputPath('digital-elimination.png') });
  await page.keyboard.press('r');
  await expect(page.getByText('RECARREGANDO...', { exact: true })).toBeVisible();
  await expect.poll(() => stat(page, 'magazine')).toBe(30);
  await expect.poll(() => stat(page, 'reserve')).toBe(150 - (30 - ammo));
  await page.mouse.down(); await expect.poll(() => stat(page, 'magazine'), { timeout: 6500 }).toBe(0); await page.mouse.up();
  await expect(page.getByText('SEM CARGA', { exact: true })).toBeVisible();
  await page.waitForTimeout(250); expect(await stat(page, 'magazine')).toBe(0);
  await pause(page); await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  await expect(page.getByRole('button', { name: 'TREINAMENTO', exact: true })).toBeFocused();
  await expect(page.getByText('Renderização ativa')).toBeVisible();
  expect(errors).toEqual([]);
});

test('equipment selection, semi-auto fire, aim FOV and reload cancellation work with real inputs', async ({ page }, testInfo) => {
  await ready(page, true); await enter(page);
  await page.keyboard.press('2');
  await expect.poll(() => stat(page, 'selected')).toBe(1);
  await page.waitForTimeout(250); await page.mouse.down();
  await expect.poll(() => stat(page, 'magazine')).toBe(5);
  await page.waitForTimeout(1100); expect(await stat(page, 'magazine')).toBe(5); await page.mouse.up();
  await page.screenshot({ path: testInfo.outputPath('vx-scatter.png') });
  await page.keyboard.press('r');
  await expect(page.getByText('RECARREGANDO...', { exact: true })).toBeVisible();
  await page.keyboard.press('3'); await expect.poll(() => stat(page, 'selected')).toBe(2);
  await expect.poll(() => stat(page, 'reload')).toBe(0);
  await page.mouse.down({ button: 'right' });
  await expect(readout(page)).toHaveAttribute('data-aiming', 'true');
  await expect.poll(() => debugValue(page, 'fov')).toBeCloseTo(58.5);
  await page.screenshot({ path: testInfo.outputPath('arc-aim.png') });
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => debugValue(page, 'fov')).toBe(90);
  await page.mouse.click(0, 0); await expect.poll(() => stat(page, 'magazine')).toBe(4);
  await page.keyboard.press('2'); await expect.poll(() => stat(page, 'selected')).toBe(1);
  expect(await stat(page, 'magazine')).toBe(5);
});

test('pausing freezes reload and clears held fire; restart restores the entire session', async ({ page }) => {
  await ready(page); await enter(page);
  await page.mouse.down(); await expect.poll(() => stat(page, 'magazine')).toBeLessThan(29);
  await page.keyboard.press('r'); await expect.poll(() => stat(page, 'reload')).toBeGreaterThan(0);
  await pause(page); await page.mouse.up();
  const reload = await stat(page, 'reload'); const ammo = await stat(page, 'magazine');
  await page.waitForTimeout(1600);
  expect(await stat(page, 'reload')).toBe(reload); expect(await stat(page, 'magazine')).toBe(ammo);
  await enter(page, 'CONTINUAR'); await expect.poll(() => stat(page, 'magazine')).toBe(30);
  await page.waitForTimeout(500); expect(await stat(page, 'magazine')).toBe(30);
  await pause(page); await page.getByRole('button', { name: 'REINICIAR', exact: true }).click();
  await expect.poll(() => stat(page, 'reserve')).toBe(150);
  expect(await stat(page, 'eliminations')).toBe(0); expect(await stat(page, 'hits')).toBe(0);
});

test('energy field causes death, pause freezes respawn, dead input is discarded and respawn is safe', async ({ page }, testInfo) => {
  await ready(page, true); await enter(page);
  await page.keyboard.down('w');
  await expect.poll(() => debugValue(page, 'z'), { intervals: [50] }).toBeLessThan(1.5);
  await page.keyboard.up('w');
  await expect.poll(() => stat(page, 'hp')).toBe(0);
  await expect(page.getByText('VOCÊ FOI ELIMINADO', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('player-eliminated.png') });
  await pause(page);
  await page.waitForTimeout(3300); expect(await stat(page, 'hp')).toBe(0);
  await enter(page, 'CONTINUAR');
  await page.keyboard.down('w'); await page.mouse.down(); await page.keyboard.press('3');
  await expect.poll(() => stat(page, 'hp')).toBe(100);
  await page.waitForTimeout(400);
  expect(await stat(page, 'magazine')).toBe(30); expect(await stat(page, 'selected')).toBe(0);
  expect(await debugValue(page, 'z')).toBeCloseTo(16, 1);
  await page.keyboard.up('w'); await page.mouse.up();
  await page.screenshot({ path: testInfo.outputPath('player-respawned.png') });
});

test('audio is gesture-gated, mute applies and repeated exit closes audio and WebGL contexts', async ({ page }) => {
  await page.addInitScript(() => {
    const contexts: AudioContext[] = []; let sounds = 0;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original { constructor() { super(); contexts.push(this); } };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) { sounds++; return Reflect.apply(start, this, args); };
    const graphics = new Set<WebGL2RenderingContext>(); const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      const context = Reflect.apply(getContext, this, [type, ...args]);
      if (type === 'webgl2' && context) graphics.add(context);
      return context;
    } as typeof getContext;
    Object.assign(window, { audioStats: () => ({ contexts: contexts.length, active: contexts.filter((context) => context.state !== 'closed').length, sounds,
      graphics: [...graphics].filter((context) => !context.isContextLost()).length }) });
  });
  const audio = () => page.evaluate(() => (window as unknown as { audioStats(): { contexts: number; active: number; sounds: number; graphics: number } }).audioStats());
  await ready(page); expect((await audio()).contexts).toBe(0);
  for (let i = 0; i < 3; i++) {
    if (i) {
      await page.getByRole('button', { name: 'TREINAMENTO', exact: true }).click();
      await page.getByRole('button', { name: 'INICIAR TREINAMENTO' }).click();
      await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible({ timeout: 20000 });
    }
    await enter(page);
    const before = (await audio()).sounds;
    await page.mouse.down(); await expect.poll(() => stat(page, 'magazine')).toBeLessThan(30); await page.mouse.up();
    if (!i) {
      expect((await audio()).sounds).toBeGreaterThan(before);
      await pause(page); await page.getByRole('button', { name: 'CONFIGURAÇÕES', exact: true }).click();
      await page.getByRole('tab', { name: 'ÁUDIO', exact: true }).click(); await page.getByLabel('Volume geral', { exact: true }).fill('0');
      await page.keyboard.press('Escape'); await enter(page, 'CONTINUAR');
      const muted = (await audio()).sounds; const ammo = await stat(page, 'magazine');
      await page.mouse.down(); await expect.poll(() => stat(page, 'magazine')).toBeLessThan(ammo); await page.mouse.up();
      expect((await audio()).sounds).toBe(muted);
    } else expect((await audio()).sounds).toBe(before);
    await pause(page); await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
    await expect(page.getByText('Renderização ativa')).toBeVisible();
    await expect.poll(async () => (await audio()).active).toBe(0);
    await expect.poll(async () => (await audio()).graphics).toBe(1);
    await expect(page.locator('canvas')).toHaveCount(1);
  }
});

test('unavailable audio does not prevent combat and exploration remains free of training objects', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'AudioContext', { value: class { constructor() { throw new Error('unavailable'); } } }); });
  await ready(page); await enter(page);
  await page.mouse.down(); await expect.poll(() => stat(page, 'hits')).toBeGreaterThan(0); await page.mouse.up();
  await pause(page); await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  await page.getByRole('button', { name: 'JOGAR', exact: true }).click(); await page.getByRole('button', { name: 'EXPLORAR ARENA' }).click();
  await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible({ timeout: 20000 }); await enter(page);
  await expect(readout(page)).toHaveCount(0);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`training, weapons and readout render without overlap at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); await ready(page); await enter(page);
    const frames: PNG[] = [];
    for (const weapon of [1, 2, 3]) {
      await page.keyboard.press(String(weapon)); await expect.poll(() => stat(page, 'selected')).toBe(weapon - 1);
      frames.push(PNG.sync.read(await page.screenshot({ path: testInfo.outputPath(`equipment-${weapon}.png`) })));
    }
    let lit = 0; let changed = 0;
    for (let i = 0; i < frames[0]!.data.length; i += 4) {
      if (frames[0]!.data[i]! > 60 || frames[0]!.data[i + 1]! > 65) lit++;
      const pixel = i / 4; const x = pixel % viewport.width; const y = Math.floor(pixel / viewport.width);
      if (x > viewport.width / 2 && y > viewport.height * 0.45 && y < viewport.height * 0.83 &&
        Math.abs(frames[0]!.data[i]! - frames[2]!.data[i]!) > 15) changed++;
    }
    expect(lit).toBeGreaterThan(viewport.width * viewport.height * 0.15);
    expect(changed).toBeGreaterThan(100);
    expect(await page.locator('canvas').boundingBox()).toMatchObject({ x: 0, y: 0, ...viewport });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const health = (await page.locator('.combat-health').boundingBox())!; const weapon = (await page.locator('.combat-weapon').boundingBox())!;
    expect(health.x + health.width).toBeLessThan(weapon.x); expect(weapon.x + weapon.width).toBeLessThanOrEqual(viewport.width);
    await pause(page); await page.screenshot({ path: testInfo.outputPath('training-pause.png') });
  });
}
