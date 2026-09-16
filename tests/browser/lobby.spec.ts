import { expect, test, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createMovementNetwork } from '../../server/src/network/createMovementNetwork';
import { io } from 'socket.io-client';
import { NETWORK_VERSION } from '../../shared/src/network/protocol';

const lobby = (page: Page) => page.getByLabel('Lobby da sala');
async function create(page: Page, name = 'Chris', max = '8', address?: string) {
  await page.goto('/#multiplayer'); await page.getByLabel('Nome do jogador').fill(name);
  await page.getByRole('button', { name: 'CRIAR PARTIDA', exact: true }).click();
  await page.getByLabel('Nome da sala').fill('Arena do Chris');
  await page.getByLabel('Máximo de jogadores').selectOption(max);
  if (address) await page.getByLabel('Endereço do servidor').fill(address);
  await page.getByRole('button', { name: 'CRIAR SERVIDOR/SALA', exact: true }).click();
  await expect(lobby(page)).toBeVisible({ timeout: 20000 });
  return (await lobby(page).getAttribute('data-room-id'))!;
}
async function join(page: Page, id: string, name = 'Lucas', address?: string) {
  await page.goto('/#multiplayer'); await page.getByLabel('Nome do jogador').fill(name);
  await page.getByLabel('Código da sala').fill(id);
  if (address) await page.getByLabel('Endereço do servidor').fill(address);
  await page.getByRole('button', { name: 'CONECTAR', exact: true }).click();
}

test('host creates, shares an address, requires readiness, starts combat and closes the room on exit', async ({ page, browser }, info) => {
  test.setTimeout(60000);
  const context = await browser.newContext(); const other = await context.newPage();
  const errors: string[] = []; for (const p of [page, other]) p.on('pageerror', (e) => errors.push(e.message));
  try {
    const id = await create(page);
    await expect(page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true })).toBeDisabled();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'COPIAR ENDEREÇO' }).click();
    const address = await page.evaluate(() => navigator.clipboard.readText());
    expect(address).toContain(`?room=${id}`);
    await join(other, '', 'Lucas', address); await expect(lobby(other)).toBeVisible();
    await expect(lobby(page).locator('tbody tr')).toHaveCount(2);
    await expect(lobby(other)).toContainText('HOST');
    await expect(other.getByRole('button', { name: 'INICIAR PARTIDA', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true })).toBeDisabled();
    await other.getByRole('button', { name: 'PRONTO', exact: true }).click();
    await expect(page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true })).toBeEnabled();
    await other.getByRole('button', { name: 'CANCELAR PRONTO', exact: true }).click();
    await expect(page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true })).toBeDisabled();
    await other.getByRole('button', { name: 'PRONTO', exact: true }).click();
    await page.screenshot({ path: info.outputPath('ready-lobby.png') });
    await page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true }).click();
    await expect(lobby(page)).toHaveCount(0);
    await expect(page.getByLabel('Estado do combate online')).toHaveAttribute('data-match-state', 'PLAYING');
    const late = await context.newPage(); await join(late, id, 'Late');
    await expect(late.locator('.network-status')).toHaveText('PARTIDA JÁ INICIADA');
    await page.bringToFront(); await page.getByRole('button', { name: 'ENTRAR NA ARENA' }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.pointerLockElement))).toBe(true);
    await page.mouse.down(); await page.waitForTimeout(200); await page.mouse.up();
    await expect.poll(async () => Number(await page.getByLabel('Estado do combate online').getAttribute('data-magazine'))).toBeLessThan(30);
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'DESCONECTAR' }).click();
    await expect(other.locator('.network-status')).toContainText('SALA ENCERRADA');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('room full, isolation, host reconnect and clipboard fallback are visible', async ({ page, browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext(); const b = await context.newPage(); const c = await context.newPage();
  try {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
    const id = await create(page, 'Chris', '2');
    await page.getByRole('button', { name: 'COPIAR ENDEREÇO' }).click();
    await expect(lobby(page)).toContainText('Cópia automática indisponível');
    await expect(page.getByLabel('Endereço para conexão')).toBeFocused();
    await join(b, id); await expect(lobby(b)).toBeVisible();
    await join(c, id, 'Extra'); await expect(c.locator('.network-status')).toHaveText('SALA CHEIA');
    await c.getByRole('button', { name: 'DESCONECTAR' }).click();
    const otherId = await create(c, 'Other'); expect(otherId).not.toBe(id);
    await expect(lobby(c).locator('tbody tr')).toHaveCount(1);
    await page.context().setOffline(true); await expect(lobby(b)).toContainText('RECONECTANDO');
    await page.context().setOffline(false);
    await expect(page.getByLabel('Estado da rede')).toHaveAttribute('data-state', 'connected', { timeout: 10000 });
    await expect(lobby(page)).toHaveAttribute('data-room-id', id);
    await expect(page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true })).toBeDisabled();
    await b.getByRole('button', { name: 'SAIR DA SALA' }).click();
    await expect(lobby(page).locator('tbody tr')).toHaveCount(1);
    await page.getByRole('button', { name: 'SAIR DA SALA' }).click();
    await expect(lobby(c)).toHaveAttribute('data-room-id', otherId);
  } finally { await context.close(); }
});

test('finished room match returns to the same lobby with cleared readiness and fresh equipment', async ({ page, browser }) => {
  test.setTimeout(45000);
  const http = createServer(); const network = await createMovementNetwork(http, { mode: 'ffa', countdownTicks: 1, durationTicks: 180, eliminationLimit: 30 });
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const bound = http.address(); if (!bound || typeof bound === 'string') throw Error('No address');
  const address = `http://127.0.0.1:${bound.port}`;
  const context = await browser.newContext(); const other = await context.newPage();
  try {
    const id = await create(page, 'Chris', '8', address); await join(other, id, 'Lucas', address);
    await other.getByRole('button', { name: 'PRONTO', exact: true }).click();
    await page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true }).click();
    await expect(page.getByLabel('Resultado da partida')).toBeVisible({ timeout: 10000 });
    await other.getByRole('button', { name: 'VOLTAR AO LOBBY', exact: true }).click();
    for (const p of [page, other]) { await expect(lobby(p)).toHaveAttribute('data-room-id', id); await expect(p.getByLabel('Estado do combate online')).toHaveAttribute('data-magazine', '30'); }
    await expect(page.getByRole('button', { name: 'INICIAR PARTIDA', exact: true })).toBeDisabled();
    await expect(other.getByRole('button', { name: 'PRONTO', exact: true })).toBeEnabled();
  } finally { await context.close(); await page.goto('/'); await network.close(); }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`room form and lobby fit ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await create(page, 'ABCDEFGHIJKLMNOPQRST');
    await expect(page.getByLabel('Estado da rede')).toHaveAttribute('data-state', 'connected');
    await page.screenshot({ path: info.outputPath('lobby.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await lobby(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await lobby(page).locator('th,td,button').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent))).toEqual([]);
    await page.getByRole('button', { name: 'SAIR DA SALA' }).click();
    await expect(page.getByRole('heading', { name: 'MULTIPLAYER', exact: true })).toBeVisible();
  });
}

test('missing rooms, incompatible versions and invalid room links have explicit errors', async ({ page }) => {
  await join(page, 'DEADBEEF'); await expect(page.locator('.network-status')).toHaveText('SALA NÃO ENCONTRADA');
  await page.getByRole('button', { name: 'DESCONECTAR' }).click();
  for (const address of ['http://localhost:3100?room=bad', 'http://localhost:3100?room=12345678&other=1', 'http://user:pass@localhost:3100', 'javascript:alert(1)']) {
    await page.getByLabel('Código da sala').fill(''); await page.getByLabel('Endereço do servidor').fill(address);
    await page.getByRole('button', { name: 'CONECTAR', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Endereço inválido');
  }
  await page.goto('/#multiplayer');
  let injected = false;
  await page.routeWebSocket(/\/socket\.io\//, (route) => {
    const server = route.connectToServer();
    route.onMessage((message) => {
      if (typeof message === 'string' && message.startsWith('40/rooms,{')) { injected = true; server.send(`40/rooms,${JSON.stringify({ ...JSON.parse(message.slice(9)), version: 999 })}`); }
      else server.send(message);
    });
  });
  await page.reload();
  await page.getByLabel('Endereço do servidor').fill('http://127.0.0.1:3100');
  await page.getByRole('button', { name: 'CONECTAR', exact: true }).click();
  await expect.poll(() => injected).toBe(true);
  await expect(page.locator('.network-status')).toHaveText('VERSÃO INCOMPATÍVEL');
});

test('lobby updates cannot hide WebGL failure and disconnect remains available', async ({ browser, baseURL }) => {
  // Deliberate GPU context loss must not affect the next test's browser process.
  const isolated = await browser.browserType().launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await isolated.newPage({ baseURL });
  try {
    await create(page);
    await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
    await expect(page.getByRole('alert')).toContainText('Não foi possível manter a cena 3D');
    await page.waitForTimeout(400);
    await expect(page.getByRole('alert')).toContainText('Não foi possível manter a cena 3D');
    await expect(lobby(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'DESCONECTAR' }).click();
    await expect(page.getByRole('heading', { name: 'MULTIPLAYER', exact: true })).toBeVisible();
  } finally { await isolated.close(); }
});

test('an eight-player lobby stays readable and its leave action remains reachable at 320px', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 640 }); const id = await create(page, 'ABCDEFGHIJKLMNOPQRST');
  const sockets: ReturnType<typeof io>[] = [];
  try {
    for (let index = 0; index < 7; index++) {
      const socket = io('http://127.0.0.1:3100/rooms', { transports: ['websocket'], autoConnect: false, reconnection: false,
        auth: { version: NETWORK_VERSION, name: `ABCDEFGHIJKLMNOPQRS${index}`, room: { action: 'join', id } } });
      sockets.push(socket); socket.on('network:probe', (ack) => ack());
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Peer timeout')), 5000);
        socket.once('network:welcome', () => { clearTimeout(timer); resolve(); });
        socket.once('connect_error', (e) => { clearTimeout(timer); reject(e); });
        socket.once('network:error', (e) => { clearTimeout(timer); reject(Error(e)); }); socket.connect();
      });
    }
    await expect(lobby(page).locator('tbody tr')).toHaveCount(8);
    expect(await lobby(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath('full-lobby.png') });
    await page.getByRole('button', { name: 'SAIR DA SALA' }).click();
    await expect(page.getByRole('heading', { name: 'MULTIPLAYER', exact: true })).toBeVisible();
  } finally { sockets.forEach((socket) => socket.disconnect()); }
});
