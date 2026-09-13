import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`foundation renders and animates at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'NEON STRIKE', exact: true })).toBeVisible();
    await expect(page.getByText('Servidor online', { exact: true })).toBeVisible();
    await expect(page.getByText('Renderização ativa', { exact: true })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
    const canvas = page.locator('canvas');
    const bounds = await canvas.boundingBox();
    expect(bounds?.width).toBe(viewport.width);
    expect(bounds?.height).toBe(viewport.height);

    const first = PNG.sync.read(await canvas.screenshot());
    let coloredPixels = 0;
    for (let i = 0; i < first.data.length; i += 4) {
      const red = first.data[i]!;
      const green = first.data[i + 1]!;
      const blue = first.data[i + 2]!;
      if ((green > red * 1.3 && green > 45) || (red > green * 1.3 && red > 80)) coloredPixels++;
    }
    expect(coloredPixels).toBeGreaterThan(first.width * first.height * 0.005);
    let clippedPixels = 0;
    for (let y = Math.floor(first.height * 0.25); y < first.height * 0.7; y++) {
      for (const x of [0, 1, first.width - 2, first.width - 1]) {
        const i = (y * first.width + x) * 4;
        if (first.data[i]! > 80 || first.data[i + 1]! > 80) clippedPixels++;
      }
    }
    expect(clippedPixels).toBe(0);
    await expect.poll(async () => {
      const next = PNG.sync.read(await canvas.screenshot());
      let changed = 0;
      for (let i = 0; i < first.data.length; i += 4) {
        if (Math.abs(first.data[i]! - next.data[i]!) > 15 || Math.abs(first.data[i + 1]! - next.data[i + 1]!) > 15) changed++;
      }
      return changed;
    }).toBeGreaterThan(250);

    const title = await page.locator('h1').boundingBox();
    const footer = await page.locator('footer').boundingBox();
    expect(title!.x + title!.width).toBeLessThanOrEqual(viewport.width);
    expect(title!.y + title!.height).toBeLessThan(footer!.y);
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const screen = PNG.sync.read(await page.screenshot({ path: testInfo.outputPath('foundation.png'), fullPage: true }));
    let titlePixels = 0;
    for (let y = Math.floor(title!.y); y < title!.y + title!.height; y++) {
      for (let x = Math.floor(title!.x); x < title!.x + title!.width; x++) {
        const i = (y * screen.width + x) * 4;
        if (screen.data[i]! > 170 && screen.data[i + 1]! > 170 && screen.data[i + 2]! > 170) titlePixels++;
      }
    }
    expect(titlePixels).toBeGreaterThan(100);
    expect(errors).toEqual([]);
  });
}

test('backend outage is visible, rendering continues, and health recovers', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/');
  await expect(page.getByText('Servidor indisponível', { exact: true })).toBeVisible();
  await expect(page.getByText('Renderização ativa', { exact: true })).toBeVisible();
  await page.unroute('**/api/health');
  await expect(page.getByText('Servidor online', { exact: true })).toBeVisible({ timeout: 10000 });
});

test('protocol mismatch is not reported as a successful connection', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: {
    status: 'ok', service: 'neon-strike-server', version: '99.0.0', protocolVersion: 999,
  } }));
  await page.goto('/');
  await expect(page.getByText('Versão incompatível', { exact: true })).toBeVisible();
});

test('missing WebGL displays a readable fallback', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl2' || type === 'webgl') return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Renderização indisponível');
  await expect(page.getByText('Servidor online', { exact: true })).toBeVisible();
});

test('resize and reload preserve a single working viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Renderização ativa', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 900, height: 650 });
  await expect.poll(async () => (await page.locator('canvas').boundingBox())?.width).toBe(900);
  await page.reload();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByText('Renderização ativa', { exact: true })).toBeVisible();
  await expect(page.getByText('Servidor online', { exact: true })).toBeVisible();
});
