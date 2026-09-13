import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

async function ready(page: Page, debug = true) {
  await page.goto('/#arena');
  await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible({ timeout: 20000 });
  if (debug) await page.getByLabel('Debug do jogador').check();
}
async function enter(page: Page, name = 'ENTRAR NA ARENA') {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.locator('.fps-screen')).toHaveAttribute('data-player-status', 'playing');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
}
async function value(page: Page, name: string) {
  return Number(await page.getByLabel('Diagnóstico do jogador').getAttribute(`data-${name}`));
}
async function paused(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
}

test('real Pointer Lock, WASD, sprint, jump, mouse look and Escape work in the arena', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page); await enter(page);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect.poll(() => value(page, 'y')).toBeGreaterThan(3);
  const initial = PNG.sync.read(await page.screenshot({ path: testInfo.outputPath('fps-start.png') }));
  let litPixels = 0;
  for (let i = initial.width * 100 * 4; i < initial.data.length - initial.width * 100 * 4; i += 4) {
    if (initial.data[i]! > 60 || initial.data[i + 1]! > 65) litPixels++;
  }
  expect(litPixels).toBeGreaterThan(initial.width * initial.height * 0.15);
  await page.keyboard.down('w');
  await expect.poll(() => value(page, 'z')).toBeLessThan(13);
  await page.keyboard.down('Shift');
  await expect.poll(() => value(page, 'speed')).toBeGreaterThan(7.5);
  await expect.poll(() => value(page, 'y')).toBeLessThan(2);
  await page.keyboard.up('Shift'); await page.keyboard.up('w');
  await expect.poll(() => value(page, 'speed')).toBeLessThan(0.1);
  const beforeJump = await value(page, 'y');
  await page.keyboard.down('Space');
  await expect.poll(() => value(page, 'y')).toBeGreaterThan(beforeJump + 0.3);
  await page.keyboard.up('Space');
  await expect.poll(async () => page.getByLabel('Diagnóstico do jogador').getAttribute('data-grounded')).toBe('true');
  const startX = await value(page, 'x');
  await page.keyboard.down('d');
  await expect.poll(() => value(page, 'x')).toBeGreaterThan(startX + 1);
  await page.keyboard.up('d');
  const yaw = await value(page, 'yaw');
  await page.mouse.move(700, 400); await page.mouse.move(820, 430, { steps: 8 });
  await expect.poll(async () => Math.abs(await value(page, 'yaw') - yaw)).toBeGreaterThan(0.05);
  await page.screenshot({ path: testInfo.outputPath('fps-moved.png') });
  await paused(page);
  const stoppedZ = await value(page, 'z');
  await page.keyboard.down('w');
  await page.waitForTimeout(400);
  expect(await value(page, 'z')).toBeCloseTo(stoppedZ, 2);
  await page.keyboard.up('w');
  await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await expect(page.getByText('Renderização ativa')).toBeVisible();
  expect(errors).toEqual([]);
});

test('pause settings apply FOV, sensitivity and video without remounting or moving the player', async ({ page }) => {
  await ready(page); await enter(page);
  await page.keyboard.down('w'); await expect.poll(() => value(page, 'z')).toBeLessThan(14);
  await page.keyboard.up('w'); await paused(page);
  const canvas = await page.locator('canvas').elementHandle();
  const z = await value(page, 'z');
  await page.getByRole('button', { name: 'CONFIGURAÇÕES', exact: true }).click();
  await page.getByLabel('FOV da partida', { exact: true }).fill('105');
  await page.getByLabel('FPS máximo').selectOption('30');
  await page.getByLabel('Qualidade', { exact: true }).selectOption('low');
  await page.getByRole('tab', { name: 'CONTROLES', exact: true }).click();
  await page.getByLabel('Sensibilidade do mouse', { exact: true }).fill('1.8');
  await page.getByRole('tab', { name: 'JOGABILIDADE', exact: true }).click();
  await page.getByLabel('Head bob', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Restaurar padrões', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await expect(page.getByRole('tab', { name: 'JOGABILIDADE', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeFocused();
  expect(await value(page, 'z')).toBeCloseTo(z, 2);
  await expect.poll(() => value(page, 'fov')).toBe(105);
  await expect.poll(async () => (await value(page, 'camera-y')) - (await value(page, 'y'))).toBeCloseTo(1.62, 2);
  expect(await canvas!.evaluate((element) => element === document.querySelector('canvas'))).toBe(true);
  expect(await canvas!.evaluate((element: HTMLCanvasElement) => element.width)).toBe(960);
  await enter(page, 'CONTINUAR'); await paused(page);
  await page.getByRole('button', { name: 'REINICIAR', exact: true }).click();
  await expect(page.locator('.fps-screen')).toHaveAttribute('data-player-status', 'playing');
  await expect.poll(() => value(page, 'z')).toBeCloseTo(16, 1);
  await expect.poll(() => value(page, 'y')).toBeCloseTo(3.01, 1);
  await paused(page);
  await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'CONFIGURAÇÕES', exact: true }).click();
  await expect(page.getByLabel('FOV da partida')).toHaveValue('105');
});

test('blur while a key is held pauses and resume requires a new movement keydown', async ({ page }) => {
  await ready(page); await enter(page);
  await page.keyboard.down('w'); await expect.poll(() => value(page, 'z')).toBeLessThan(14);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page.waitForTimeout(300);
  const z = await value(page, 'z');
  await page.keyboard.up('w');
  await enter(page, 'CONTINUAR');
  await page.waitForTimeout(500);
  expect(await value(page, 'z')).toBeCloseTo(z, 2);
  expect(await value(page, 'speed')).toBe(0);
});

test('Pointer Lock rejection is visible, keeps input disabled and can be retried', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Element.prototype.requestPointerLock;
    let calls = 0;
    Element.prototype.requestPointerLock = function (...args) {
      if (++calls === 1) return Promise.reject(new Error('denied'));
      return Reflect.apply(original, this, args);
    };
  });
  await ready(page);
  await page.getByRole('button', { name: 'ENTRAR NA ARENA' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível capturar o mouse');
  await page.keyboard.down('w'); await page.keyboard.up('w');
  await expect.poll(() => value(page, 'z')).toBeCloseTo(16, 1);
  await enter(page);
});

test('hidden tab suspends the frame loop and returning does not resume movement automatically', async ({ page }) => {
  await ready(page); await enter(page);
  await page.keyboard.down('w'); await expect.poll(() => value(page, 'z')).toBeLessThan(14);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeVisible();
  const z = await value(page, 'z');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.keyboard.up('w');
  await page.waitForTimeout(400);
  expect(await value(page, 'z')).toBeCloseTo(z, 2);
  await expect(page.locator('.fps-screen')).toHaveAttribute('data-player-status', 'paused');
});

test('repeated exploration and return releases old contexts and retains the configured player', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const contexts = new Set<WebGL2RenderingContext>();
    Object.assign(window, { livePlayerContexts: () => [...contexts].filter((context) => !context.isContextLost()).length });
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      const result = Reflect.apply(original, this, [type, ...args]);
      if (type === 'webgl2' && result) contexts.add(result as WebGL2RenderingContext);
      return result;
    } as typeof original;
  });
  await page.goto('/#play');
  await page.getByLabel('Nome do jogador').fill('Chris');
  for (let round = 0; round < 3; round++) {
    await page.getByRole('button', { name: 'EXPLORAR ARENA' }).click();
    await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible({ timeout: 20000 });
    await enter(page); await paused(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as { livePlayerContexts(): number }).livePlayerContexts())).toBe(1);
    await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
    await expect(page.getByText('Renderização ativa')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => (window as unknown as { livePlayerContexts(): number }).livePlayerContexts())).toBe(1);
    await page.getByRole('button', { name: 'JOGAR', exact: true }).click();
    await expect(page.getByLabel('Nome do jogador')).toHaveValue('Chris');
  }
});

test('context loss releases the mouse and exposes a working return path', async ({ page }) => {
  await ready(page); await enter(page);
  await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
  await expect(page.getByRole('alert')).toContainText('Não foi possível manter a cena 3D');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page.getByRole('button', { name: 'VOLTAR AO MENU' }).click();
  await expect(page.getByText('Renderização ativa')).toBeVisible();
});

test('leaving a still-loading controller prevents late creation of another canvas', async ({ page }) => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/src/game/player/createPlayerScene.ts', async (route) => { await pending; await route.continue(); });
  await page.goto('/#arena');
  await expect(page.getByRole('heading', { name: 'CARREGANDO MAPA...' })).toBeVisible();
  await page.getByRole('button', { name: 'VOLTAR A JOGAR' }).click();
  release!();
  await expect(page.getByRole('button', { name: 'EXPLORAR ARENA' })).toBeFocused();
  await expect(page.getByText('Renderização ativa')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'EXPLORAR ARENA' }).click();
  await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible({ timeout: 20000 });
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`player entry and pause remain usable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await ready(page, false);
    await page.screenshot({ path: testInfo.outputPath('player-entry.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await enter(page);
    expect(await page.locator('canvas').boundingBox()).toMatchObject({ x: 0, y: 0, ...viewport });
    const png = PNG.sync.read(await page.screenshot({ path: testInfo.outputPath('player-view.png') }));
    let bright = 0;
    for (let i = 0; i < png.data.length; i += 4) if (png.data[i]! > 60 || png.data[i + 1]! > 65) bright++;
    expect(bright).toBeGreaterThan(png.width * png.height * 0.15);
    await paused(page);
    await page.screenshot({ path: testInfo.outputPath('player-pause.png') });
    const dialog = (await page.getByRole('dialog').boundingBox())!;
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.y).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(viewport.width);
    expect(dialog.y + dialog.height).toBeLessThanOrEqual(viewport.height);
    await expect(page.getByLabel('Debug do jogador')).not.toBeChecked();
  });
}
