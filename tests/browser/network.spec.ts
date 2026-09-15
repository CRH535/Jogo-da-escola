import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import type { NetworkPlayer } from '../../shared/src/network/protocol';

const readout = (page: Page) => page.getByLabel('Estado da rede');
const cursors = new WeakMap<Page, { x: number; y: number }>();
async function roster(page: Page): Promise<NetworkPlayer[]> { return JSON.parse(await readout(page).getAttribute('data-players') ?? '[]'); }
async function join(page: Page, name: string, address?: string) {
  await page.goto('/#multiplayer'); await page.getByLabel('Nome do jogador').fill(name);
  if (address) await page.getByLabel('Endereço do servidor').fill(address);
  await page.getByRole('button', { name: 'CONECTAR', exact: true }).click();
  await expect(readout(page)).toHaveAttribute('data-state', 'connected', { timeout: 20000 });
  await page.getByLabel('Debug do jogador').check();
  return (await readout(page).getAttribute('data-id'))!;
}
async function enter(page: Page) {
  await page.bringToFront(); const bounds = (await page.locator('[data-player-resume]').boundingBox())!;
  await page.locator('[data-player-resume]').click(); cursors.set(page, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
}
async function position(page: Page, axis: string) { return Number(await page.getByLabel('Diagnóstico do jogador').getAttribute(`data-${axis}`)); }
async function face(page: Page, yaw: number) {
  const current = await position(page, 'yaw'); const cursor = cursors.get(page)!;
  cursor.x -= Math.atan2(Math.sin(yaw - current), Math.cos(yaw - current)) / 0.002;
  await page.mouse.move(cursor.x, cursor.y);
  await expect.poll(async () => Math.abs(Math.atan2(Math.sin(await position(page, 'yaw') - yaw), Math.cos(await position(page, 'yaw') - yaw)))).toBeLessThan(0.01);
}

test('remote avatar renders in the real map and disappears on disconnect', async ({ page, browser }, info) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const other = await context.newPage();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await join(page, 'Chris'); await join(other, 'Lucas');
    await expect(page.getByLabel('Estado do combate online')).toHaveAttribute('data-match-state', 'PLAYING');
    for (const p of [other, page]) {
      await enter(p); await face(p, 0); await p.keyboard.down('w');
      await expect.poll(() => position(p, 'z')).toBeLessThan(-18.8); await p.keyboard.up('w');
      await expect.poll(() => position(p, 'speed')).toBeLessThan(0.1);
      await face(p, p === page ? -Math.PI / 2 : Math.PI / 2);
      if (p === other) await p.keyboard.press('Escape');
    }
    await page.keyboard.down('w'); await page.keyboard.down('Shift');
    await expect.poll(() => position(page, 'x'), { timeout: 10000 }).toBeGreaterThan(10);
    await page.keyboard.up('w'); await page.keyboard.up('Shift'); await expect.poll(() => position(page, 'speed')).toBeLessThan(0.1);
    const before = PNG.sync.read(await page.screenshot({ path: info.outputPath('remote-avatar-visible.png') }));
    await other.getByRole('button', { name: 'DESCONECTAR', exact: true }).click();
    await expect(page.getByLabel('Jogadores conectados')).toHaveText('1');
    if (await page.locator('[data-player-resume]').isVisible()) await enter(page);
    await expect(page.locator('.fps-screen')).toHaveAttribute('data-player-status', 'playing');
    const after = PNG.sync.read(await page.screenshot({ path: info.outputPath('remote-avatar-removed.png') }));
    let changed = 0;
    for (let y = 300; y < 650; y++) for (let x = 500; x < 950; x++) {
      const i = (y * before.width + x) * 4;
      if (Math.abs(before.data[i]! - after.data[i]!) + Math.abs(before.data[i + 1]! - after.data[i + 1]!) + Math.abs(before.data[i + 2]! - after.data[i + 2]!) > 30) changed++;
    }
    expect(changed).toBeGreaterThan(150);
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'DESCONECTAR', exact: true }).click();
  } finally { await context.close(); }
});

test('150 ms simulated RTT preserves bounded movement, snapshot rate and prediction convergence', async ({ page }) => {
  test.setTimeout(45000);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let outgoing = 0; let snapshots = 0; let incomingBytes = 0;
  const later = (fn: () => void) => { const timer = setTimeout(() => { timers.delete(timer); fn(); }, 75); timers.add(timer); };
  await page.routeWebSocket(/\/socket\.io\//, (route) => {
    const server = route.connectToServer(); let clientClosed = false; let serverClosed = false;
    route.onMessage((message) => { if (String(message).includes('player:input')) outgoing++; later(() => { if (!serverClosed) server.send(message); }); });
    server.onMessage((message) => { if (String(message).includes('world:state')) { snapshots++; incomingBytes += Buffer.byteLength(message); } later(() => { if (!clientClosed) route.send(message); }); });
    route.onClose(() => { clientClosed = true; later(() => { if (!serverClosed) void server.close(); }); });
    server.onClose(() => { serverClosed = true; if (!clientClosed) void route.close(); });
  });
  try {
    const id = await join(page, 'Latency'); await enter(page); await face(page, 0);
    const started = Date.now(); outgoing = 0; snapshots = 0; incomingBytes = 0;
    await page.keyboard.down('w'); await page.keyboard.down('Shift');
    await page.waitForTimeout(3000); await page.keyboard.up('w'); await page.keyboard.up('Shift');
    await expect(readout(page)).toHaveAttribute('data-state', 'connected');
    await expect.poll(async () => Math.abs((await roster(page)).find((p) => p.id === id)!.pose.z - await position(page, 'z'))).toBeLessThan(0.05);
    expect(await position(page, 'z')).toBeGreaterThan(-19.2); expect(await position(page, 'z')).toBeLessThan(-18.8);
    const seconds = (Date.now() - started) / 1000;
    expect(outgoing / seconds).toBeLessThan(34); expect(outgoing / seconds).toBeGreaterThan(20);
    expect(snapshots / seconds).toBeLessThan(23); expect(snapshots / seconds).toBeGreaterThan(14);
    expect(incomingBytes / seconds).toBeLessThan(25000);
    await expect.poll(async () => parseInt(await page.getByLabel('Ping', { exact: true }).innerText())).toBeGreaterThanOrEqual(140);
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'DESCONECTAR' }).click();
    await expect.poll(() => timers.size).toBe(0);
  } finally { for (const timer of timers) clearTimeout(timer); }
});

test('server combat reaches both browsers: equipment, reload, elimination, score and safe respawn', async ({ page, browser }, info) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const other = await context.newPage(); const errors: string[] = [];
  for (const p of [page, other]) p.on('pageerror', (e) => errors.push(e.message));
  const hud = (p: Page) => p.getByLabel('Estado do combate online');
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await join(page, 'Chris'); await join(other, 'Lucas');
    await expect(hud(page)).toHaveAttribute('data-match-state', 'PLAYING');
    for (const p of [other, page]) {
      await enter(p); await face(p, 0); await p.keyboard.down('w');
      await expect.poll(() => position(p, 'z')).toBeLessThan(-18.8); await p.keyboard.up('w');
      await expect.poll(() => position(p, 'speed')).toBeLessThan(0.1);
      await face(p, p === page ? -Math.PI / 2 : Math.PI / 2);
      if (p === other) await p.keyboard.press('Escape');
    }
    await page.keyboard.down('w'); await page.keyboard.down('Shift');
    await expect.poll(() => position(page, 'x'), { timeout: 10000 }).toBeGreaterThan(10);
    await page.keyboard.up('w'); await page.keyboard.up('Shift');
    await expect.poll(() => position(page, 'speed')).toBeLessThan(0.1);
    await page.keyboard.press('3'); await expect(hud(page)).toHaveAttribute('data-selected', '2');
    await page.mouse.down({ button: 'right' }); await expect(hud(page)).toHaveAttribute('data-aiming', 'true');
    await expect.poll(() => position(page, 'fov')).toBeLessThan(70);
    await page.mouse.up({ button: 'right' });
    await page.keyboard.press('2'); await expect(hud(page)).toHaveAttribute('data-selected', '1');
    await page.keyboard.press('1'); await expect(hud(page)).toHaveAttribute('data-selected', '0');
    await page.waitForTimeout(250);
    await page.mouse.down();
    await expect(hud(other)).toHaveAttribute('data-hp', '0');
    await page.mouse.up();
    await expect(hud(page)).toHaveAttribute('data-eliminations', '1');
    await expect(hud(page)).toHaveAttribute('data-score', '100');
    await expect(hud(other)).toHaveAttribute('data-deaths', '1');
    await page.screenshot({ path: info.outputPath('online-elimination.png') });
    await page.keyboard.press('r');
    await expect.poll(async () => Number(await hud(page).getAttribute('data-reload'))).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(hud(page)).toHaveAttribute('data-magazine', '30');
    await expect.poll(async () => Number(await hud(page).getAttribute('data-reserve'))).toBeLessThan(150);
    await expect(hud(other)).toHaveAttribute('data-hp', '100');
    await enter(other);
    await other.keyboard.down('Tab');
    const board = other.getByRole('region', { name: 'Placar', exact: true });
    await expect(board.locator('tbody tr').first()).toContainText('Chris');
    await expect(board.locator('tbody tr').first().locator('.score-points')).toHaveText('100');
    await other.screenshot({ path: info.outputPath('online-respawn-scoreboard.png') });
    await other.keyboard.up('Tab'); await other.keyboard.press('Escape');
    await other.getByRole('button', { name: 'DESCONECTAR', exact: true }).click();
    await page.bringToFront(); await page.getByRole('button', { name: 'DESCONECTAR', exact: true }).click();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('reconnection waits for an old half-open transport to release the same identity', async ({ page }) => {
  test.setTimeout(30000);
  let drop = false; let connections = 0; let resumedWhileBusy = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  await page.routeWebSocket(/\/socket\.io\//, (route) => {
    const server = route.connectToServer(); const first = ++connections === 1;
    route.onMessage((message) => { if (!first || !drop) server.send(message); });
    server.onMessage((message) => {
      if (String(message).includes('IN_USE')) resumedWhileBusy++;
      if (!first || !drop) route.send(message);
    });
    route.onClose(() => {
      if (!first) { void server.close(); return; }
      const timer = setTimeout(() => { timers.delete(timer); void server.close(); }, 1800); timers.add(timer);
    });
  });
  try {
    const id = await join(page, 'Half-open'); await enter(page); drop = true;
    await expect(readout(page)).toHaveAttribute('data-state', 'reconnecting', { timeout: 5000 });
    await expect(readout(page)).toHaveAttribute('data-state', 'connected', { timeout: 10000 });
    await expect(readout(page)).toHaveAttribute('data-id', id);
    expect(resumedWhileBusy).toBeGreaterThan(0);
    await expect(page.locator('.fps-screen')).toHaveAttribute('data-player-status', 'paused');
    await page.getByRole('button', { name: 'DESCONECTAR' }).click();
  } finally { for (const timer of timers) clearTimeout(timer); }
});

test('two browsers share authoritative movement, real pointer lock, jumps, ping and a local-only menu', async ({ page, browser }, info) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const other = await context.newPage();
  const errors: string[] = []; for (const p of [page, other]) p.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    const a = await join(page, 'Chris'); const b = await join(other, 'Lucas', 'http://127.0.0.1:3100');
    expect(a).not.toBe(b);
    for (const p of [page, other]) await expect(p.getByLabel('Jogadores conectados')).toHaveText('2');
    await expect(page.getByLabel('Estado do combate online')).toHaveAttribute('data-match-state', 'PLAYING');
    await enter(page);
    const start = await position(page, 'x');
    await page.keyboard.down('w');
    await expect.poll(() => position(page, 'x')).toBeGreaterThan(start + 2);
    await page.keyboard.up('w');
    await expect.poll(async () => (await roster(other)).find((p) => p.id === a)!.pose.x).toBeGreaterThan(start + 2);
    await expect.poll(async () => (await roster(page)).find((p) => p.id === a)!.ack).toBeGreaterThan(30);
    await expect.poll(() => position(page, 'speed')).toBeLessThan(0.2);
    const ground = await position(page, 'y'); await page.keyboard.down('Space');
    await expect.poll(() => position(page, 'y')).toBeGreaterThan(ground + 0.3);
    await page.keyboard.up('Space');
    await expect.poll(() => page.getByLabel('Diagnóstico do jogador').getAttribute('data-grounded')).toBe('true');
    await expect(page.getByLabel('Ping', { exact: true })).toContainText('ms');
    await page.keyboard.down('Tab');
    await expect(page.getByRole('region', { name: 'Placar', exact: true }).locator('tbody tr')).toHaveCount(2);
    await page.screenshot({ path: info.outputPath('lan-players.png') }); await page.keyboard.up('Tab');
    await expect(page.getByLabel('Estado do combate online')).toHaveAttribute('data-hp', '100');
    const pixels = PNG.sync.read(await page.screenshot({ path: info.outputPath('lan-arena.png') }));
    let lit = 0; for (let i = pixels.width * 100 * 4; i < pixels.data.length - pixels.width * 100 * 4; i += 4) if (pixels.data[i]! > 60 || pixels.data[i + 1]! > 65) lit++;
    expect(lit).toBeGreaterThan(pixels.width * pixels.height * 0.15);
    await page.keyboard.press('Escape'); await expect(page.getByRole('heading', { name: 'MENU LOCAL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'REINICIAR', exact: true })).toHaveCount(0);
    const tick = Number(await readout(page).getAttribute('data-tick')); const frozen = await position(page, 'x');
    await enter(other); const bx = await position(other, 'x'); await other.keyboard.down('w');
    await expect.poll(() => position(other, 'x')).toBeLessThan(bx - 2); await other.keyboard.up('w');
    await expect.poll(async () => Number(await readout(page).getAttribute('data-tick'))).toBeGreaterThan(tick + 30);
    expect(await position(page, 'x')).toBeCloseTo(frozen, 2);
    await expect.poll(async () => (await roster(page)).find((p) => p.id === b)!.pose.x).toBeLessThan(bx - 2);
    await other.keyboard.press('Escape'); await other.getByRole('button', { name: 'DESCONECTAR', exact: true }).click();
    await expect(page.getByLabel('Jogadores conectados')).toHaveText('1');
    await page.bringToFront(); await page.getByRole('button', { name: 'DESCONECTAR', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'MULTIPLAYER', exact: true })).toBeVisible();
    await expect(page.getByLabel('Nome do jogador')).toHaveValue('Chris'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('brief transport loss resumes the same identity without automatic pointer lock or persisted credentials', async ({ page }) => {
  const id = await join(page, 'Reconnect'); await enter(page);
  await page.keyboard.down('w'); await expect.poll(() => position(page, 'x')).toBeGreaterThan(-19); await page.keyboard.up('w');
  await page.context().setOffline(true);
  await expect(readout(page)).toHaveAttribute('data-state', 'reconnecting', { timeout: 5000 });
  await expect(page.locator('.network-status')).toContainText('CONEXÃO PERDIDA');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page.context().setOffline(false);
  await expect(readout(page)).toHaveAttribute('data-state', 'connected', { timeout: 10000 });
  await expect(readout(page)).toHaveAttribute('data-id', id);
  await expect(page.locator('.fps-screen')).toHaveAttribute('data-player-status', 'paused');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['neon-strike:preferences:v1']);
  await enter(page); const x = await position(page, 'x'); await page.keyboard.down('w');
  await expect.poll(() => position(page, 'x')).toBeGreaterThan(x + 0.5); await page.keyboard.up('w');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'DESCONECTAR' }).click();
  await page.goto('/#lan'); await expect(page.getByRole('button', { name: 'CONECTAR', exact: true })).toBeVisible();
});

test('invalid addresses stay in the form and an absent server ends bounded reconnect attempts', async ({ page }) => {
  test.setTimeout(40000);
  await page.goto('/#multiplayer'); await page.getByLabel('Endereço do servidor').fill('file:///tmp');
  await page.getByRole('button', { name: 'CONECTAR', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Endereço inválido');
  await page.getByLabel('Endereço do servidor').fill('http://127.0.0.1:3999');
  await page.getByRole('button', { name: 'CONECTAR', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('SERVIDOR NÃO ENCONTRADO', { timeout: 25000 });
  await expect(page.locator('[data-player-resume]')).toBeDisabled();
  await page.getByRole('button', { name: 'DESCONECTAR', exact: true }).click();
  await expect(page.getByRole('button', { name: 'CONECTAR', exact: true })).toBeEnabled();
});

test('incompatible protocol is reported by the real server before arena entry', async ({ page }) => {
  await page.routeWebSocket(/\/socket\.io\//, (route) => {
    const server = route.connectToServer();
    route.onMessage((message) => {
      if (typeof message === 'string' && message.startsWith('40{')) {
        const auth = JSON.parse(message.slice(2)); server.send(`40${JSON.stringify({ ...auth, version: 999 })}`);
      } else server.send(message);
    });
  });
  await page.goto('/#multiplayer'); await page.getByRole('button', { name: 'CONECTAR', exact: true }).click();
  await expect(readout(page)).toHaveAttribute('data-state', 'incompatible', { timeout: 20000 });
  await expect(page.locator('.network-status')).toHaveText('VERSÃO INCOMPATÍVEL');
  await expect(page.locator('[data-player-resume]')).toBeDisabled();
  await page.getByRole('button', { name: 'DESCONECTAR' }).click();
});

test('repeated LAN sessions close old sockets and release old WebGL contexts', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext; const contexts = new Set<WebGL2RenderingContext>();
    Object.assign(window, { liveNetworkContexts: () => [...contexts].filter((context) => !context.isContextLost()).length });
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      const context = Reflect.apply(original, this, [type, ...args]); if (type === 'webgl2' && context) contexts.add(context);
      return context;
    } as typeof original;
  });
  let sockets = 0;
  page.on('websocket', (socket) => { if (!socket.url().includes('/socket.io/')) return; sockets++; socket.on('close', () => sockets--); });
  await page.goto('/#multiplayer');
  const ids = new Set<string>();
  for (let round = 0; round < 3; round++) {
    await page.getByRole('button', { name: 'CONECTAR', exact: true }).click();
    await expect(readout(page)).toHaveAttribute('data-state', 'connected', { timeout: 20000 });
    await expect(page.getByLabel('Jogadores conectados')).toHaveText('1');
    ids.add((await readout(page).getAttribute('data-id'))!); expect(sockets).toBe(1);
    await expect.poll(() => page.evaluate(() => (window as unknown as { liveNetworkContexts(): number }).liveNetworkContexts())).toBe(1);
    await page.getByRole('button', { name: 'DESCONECTAR' }).click();
    await expect(page.getByText('Renderização ativa')).toBeVisible();
    await expect.poll(() => sockets).toBe(0);
    await expect.poll(() => page.evaluate(() => (window as unknown as { liveNetworkContexts(): number }).liveNetworkContexts())).toBe(1);
  }
  expect(ids.size).toBe(3);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`LAN form, full-bleed canvas, players and menu fit ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await join(page, 'ABCDEFGHIJKLMNOPQRST');
    await page.screenshot({ path: info.outputPath('lan-entry.png') }); await enter(page);
    expect(await page.locator('canvas').boundingBox()).toMatchObject({ x: 0, y: 0, ...viewport });
    await page.screenshot({ path: info.outputPath('lan-hud.png') });
    const summary = (await page.locator('.hud-summary').boundingBox())!;
    const connection = (await page.locator('.network-summary').boundingBox())!;
    expect(connection.y >= summary.y + summary.height || connection.x >= summary.x + summary.width).toBe(true);
    const debug = (await page.getByLabel('Diagnóstico do jogador').boundingBox())!;
    const health = (await page.locator('.combat-health').boundingBox())!;
    expect(debug.y + debug.height).toBeLessThanOrEqual(health.y);
    await page.keyboard.down('Tab');
    const pixels = PNG.sync.read(await page.screenshot({ path: info.outputPath('lan-table.png') }));
    let lit = 0;
    for (let y = Math.floor(pixels.height / 2); y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
      const i = (y * pixels.width + x) * 4; if (pixels.data[i]! > 60 || pixels.data[i + 1]! > 65) lit++;
    }
    expect(lit).toBeGreaterThan(pixels.width * pixels.height * 0.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.score-table').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.keyboard.up('Tab'); await page.keyboard.press('Escape');
    const dialog = (await page.getByRole('dialog').boundingBox())!;
    expect(dialog.x).toBeGreaterThanOrEqual(0); expect(dialog.y).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(viewport.width); expect(dialog.y + dialog.height).toBeLessThanOrEqual(viewport.height);
    await page.getByRole('button', { name: 'DESCONECTAR' }).click();
  });
}
