import { expect, test, type Page, type Route } from '@playwright/test';
import { PNG } from 'pngjs';

async function ready(page: Page) {
  await expect(page.getByText('Mapa carregado', { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('canvas')).toHaveCount(1);
}
function changedPixels(first: PNG, next: PNG) {
  expect([next.width, next.height]).toEqual([first.width, first.height]);
  let changed = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    if (Math.abs(first.data[i]! - next.data[i]!) > 12 || Math.abs(first.data[i + 1]! - next.data[i + 1]!) > 12) changed++;
  }
  return changed;
}

async function sceneImage(page: Page) {
  const header = (await page.locator('.map-header').boundingBox())!;
  const footer = (await page.locator('.map-toolbar').boundingBox())!;
  return PNG.sync.read(await page.screenshot({ clip: {
    x: 0, y: header.height + 1, width: page.viewportSize()!.width, height: footer.y - header.height - 2,
  } }));
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`map is framed, nonblank and interactive at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize(viewport);
    await page.goto('/#map');
    await ready(page);
    const canvas = page.locator('canvas');
    expect(await canvas.boundingBox()).toMatchObject({ x: 0, y: 0, ...viewport });
    const first = PNG.sync.read(await page.screenshot({ path: testInfo.outputPath('map-overview.png') }));
    const header = (await page.locator('.map-header').boundingBox())!;
    const footer = (await page.locator('.map-toolbar').boundingBox())!;
    let mapPixels = 0;
    let clippedPixels = 0;
    for (let y = Math.ceil(header.y + header.height) + 3; y < footer.y - 3; y++) {
      for (let x = 0; x < first.width; x++) {
        const i = (y * first.width + x) * 4;
        const isMap = first.data[i]! > 60 || first.data[i + 1]! > 65;
        if (isMap) {
          mapPixels++;
          if (x < 3 || x >= first.width - 3 || y <= header.height + 5 || y >= footer.y - 5) clippedPixels++;
        }
      }
    }
    expect(mapPixels).toBeGreaterThan(viewport.width * viewport.height * 0.06);
    expect(clippedPixels).toBe(0);
    expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const title = (await page.locator('h1').boundingBox())!;
    expect(title.x + title.width).toBeLessThanOrEqual(viewport.width);
    expect(title.y + title.height).toBeLessThanOrEqual(header.height);

    const initialScene = await sceneImage(page);
    await page.getByLabel('Vista', { exact: true }).selectOption('core');
    await expect.poll(async () => changedPixels(initialScene, await sceneImage(page))).toBeGreaterThan(1000);
    await page.getByLabel('Vista', { exact: true }).selectOption('overview');
    const beforeOrbit = await sceneImage(page);
    await page.mouse.move(viewport.width * 0.5, viewport.height * 0.48);
    await page.mouse.down();
    await page.mouse.move(viewport.width * 0.65, viewport.height * 0.53, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => changedPixels(beforeOrbit, await sceneImage(page))).toBeGreaterThan(1000);
    await page.getByRole('button', { name: 'Restaurar vista' }).click();
    await expect.poll(async () => changedPixels(beforeOrbit, await sceneImage(page))).toBeLessThan(100);
    await page.getByLabel('Vista', { exact: true }).selectOption('spawn-07');
    await page.screenshot({ path: testInfo.outputPath('map-spawn.png') });
    expect(errors).toEqual([]);
  });
}

test('map navigation preserves setup, keyboard focus, history and a single live WebGL context', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const contexts = new Set<WebGL2RenderingContext>();
    Object.assign(window, { liveContextCount: () => [...contexts].filter((context) => !context.isContextLost()).length });
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      const result = Reflect.apply(original, this, [type, ...args]);
      if (type === 'webgl2' && result) contexts.add(result as WebGL2RenderingContext);
      return result;
    } as typeof original;
  });
  await page.goto('/#play');
  await page.getByLabel('Nome do jogador').fill('Chris');
  await page.getByLabel('Número de bots').selectOption('7');
  for (let round = 0; round < 3; round++) {
    await page.getByRole('button', { name: 'VER MAPA' }).click();
    await ready(page);
    await expect(page.locator('h1')).toBeFocused();
    await expect.poll(() => page.evaluate(() => (window as unknown as { liveContextCount(): number }).liveContextCount())).toBe(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'VER MAPA' })).toBeFocused();
    await expect(page.getByText('Renderização ativa')).toBeVisible();
    await expect(page.getByLabel('Nome do jogador')).toHaveValue('Chris');
    await expect(page.getByLabel('Número de bots')).toHaveValue('7');
    await expect(page.getByRole('button', { name: 'INICIAR PARTIDA' })).toBeEnabled();
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => (window as unknown as { liveContextCount(): number }).liveContextCount())).toBe(1);
  }
  await page.goBack(); await ready(page);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: 'Voltar a JOGAR' }).click();
  await expect(page.getByRole('button', { name: 'VER MAPA' })).toBeFocused();
});

test('spawns, physics debug, zoom and resize change the actual scene', async ({ page }, testInfo) => {
  await page.goto('/#map'); await ready(page);
  await page.getByLabel('Vista', { exact: true }).selectOption('spawn-07');
  const first = await sceneImage(page);
  await page.getByLabel('Spawns', { exact: true }).uncheck();
  await expect.poll(async () => changedPixels(first, await sceneImage(page))).toBeGreaterThan(100);
  await page.getByLabel('Colisores', { exact: true }).check();
  await expect(page.getByText('DEBUG / 19 colisores / 8 spawns')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('map-colliders.png') });
  await page.getByLabel('Colisores', { exact: true }).uncheck();
  const beforeZoom = await sceneImage(page);
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, -250);
  await expect.poll(async () => changedPixels(beforeZoom, await sceneImage(page))).toBeGreaterThan(1000);
  await page.setViewportSize({ width: 900, height: 650 });
  await expect.poll(async () => (await page.locator('canvas').boundingBox())?.width).toBe(900);
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('leaving during loading cancels initialization without a late canvas', async ({ page }) => {
  let pending: Route | undefined;
  await page.route('**/src/maps/createMapScene.ts', (route) => { pending = route; });
  await page.goto('/#map');
  await expect(page.getByText('CARREGANDO MAPA...', { exact: true })).toBeVisible();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByRole('button', { name: 'Voltar a JOGAR' }).click();
  await pending!.continue();
  await expect(page.getByText('Renderização ativa')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.unroute('**/src/maps/createMapScene.ts');
  await page.getByRole('button', { name: 'VER MAPA' }).click();
  await ready(page);
});

test('map loading failure is readable and does not trap navigation', async ({ page }) => {
  await page.route('**/src/maps/createMapScene.ts', (route) => route.abort());
  await page.goto('/#map');
  await expect(page.getByRole('alert')).toContainText('Mapa indisponível');
  await page.getByRole('button', { name: 'Voltar a JOGAR' }).click();
  await expect(page.getByRole('heading', { name: 'JOGAR', exact: true })).toBeVisible();
  await expect(page.getByText('Renderização ativa')).toBeVisible();
});

test('context loss disables map controls and reload restores the scene', async ({ page }) => {
  await page.goto('/#map'); await ready(page);
  await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
  await expect(page.getByRole('alert')).toContainText('Mapa indisponível');
  await expect(page.getByLabel('Vista', { exact: true })).toBeDisabled();
  await page.reload(); await ready(page);
});
