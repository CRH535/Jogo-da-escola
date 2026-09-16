import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { io } from 'socket.io-client';
import { NETWORK_VERSION, NET, validWelcome, validSnapshot } from '@neon-strike/shared/network';
import { createMovementNetwork } from '../dist/network/createMovementNetwork.js';
import { RoomRegistry } from '../dist/rooms/RoomRegistry.js';

const settings = { name: 'Arena do Chris', map: 'neon-facility', mode: 'ffa', maxPlayers: 8, requireReady: true };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function host(t, rules) {
  const http = createServer(); const network = await createMovementNetwork(http, rules);
  http.listen(0, '127.0.0.1'); await once(http, 'listening'); t.after(() => network.close());
  return { ...network, url: `http://127.0.0.1:${http.address().port}/rooms` };
}
async function peer(t, server, room, name = 'Chris', token) {
  const socket = io(server.url, { transports: ['websocket'], autoConnect: false, reconnection: false,
    auth: { version: NETWORK_VERSION, name, room, ...(token ? { token } : {}) } });
  t.after(() => socket.disconnect()); socket.on('network:probe', (ack) => ack());
  const welcome = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Welcome timeout')), 5000);
    const done = (fn, value) => { clearTimeout(timer); fn(value); };
    socket.once('network:welcome', (w) => done(resolve, w));
    socket.once('network:error', (code) => done(reject, Error(code)));
    socket.once('connect_error', (e) => done(reject, e)); socket.connect();
  });
  assert.ok(validWelcome(welcome));
  const command = { roomId: welcome.snapshot.lobby.id, epoch: welcome.epoch };
  return { socket, welcome, command };
}
const create = (t, s, config = {}) => peer(t, s, { action: 'create', settings: { ...settings, ...config } });
const join = (t, s, id = '', name = 'Lucas', token) => peer(t, s, { action: 'join', id }, name, token);
async function denied(p, event, packet, code) {
  const result = once(p.socket, 'lobby:error'); p.socket.emit(event, packet); assert.deepEqual(await result, [code]);
}

test('room creation, readiness and host-only start are enforced on real sockets', async (t) => {
  const s = await host(t); const a = await create(t, s); const b = await join(t, s);
  const room = s.rooms.find(a.command.roomId);
  assert.equal(room.hostId, a.welcome.id); assert.equal(room.snapshot().lobby.phase, 'LOBBY');
  assert.ok(validSnapshot(room.snapshot())); assert.ok(room.snapshot().lobby.addresses[0].startsWith('http://127.0.0.1:'));
  await denied(b, 'lobby:start', b.command, 'NOT_HOST');
  await denied(a, 'lobby:start', a.command, 'NOT_READY');
  b.socket.emit('lobby:ready', { ...b.command, ready: true }); await wait(30);
  b.socket.emit('lobby:ready', { ...b.command, ready: false }); await wait(30);
  assert.equal(room.snapshot().lobby.players.find((p) => p.id === b.welcome.id).ready, false);
  await denied(a, 'lobby:start', a.command, 'NOT_READY');
  b.socket.emit('lobby:ready', { ...b.command, ready: true }); await wait(30);
  a.socket.emit('lobby:start', a.command); await wait(50);
  assert.equal(room.snapshot().lobby.phase, 'COUNTDOWN');
  await denied(a, 'lobby:start', a.command, 'STARTED');
  await assert.rejects(join(t, s, room.id, 'Late'), /STARTED/);
});

test('capacity includes reconnect reservations and rooms never expose other-room players', async (t) => {
  const s = await host(t); const a = await create(t, s, { maxPlayers: 2 }); const b = await join(t, s, a.command.roomId);
  await assert.rejects(join(t, s, a.command.roomId, 'Extra'), /FULL/);
  const c = await create(t, s, { name: 'Other room' });
  const [snapshot] = await once(c.socket, 'world:state');
  assert.deepEqual(snapshot.players.map((p) => p.id), [c.welcome.id]);
  await assert.rejects(join(t, s), /ROOM_REQUIRED/);
  const error = once(b.socket, 'network:error');
  b.socket.emit('lobby:ready', { ...b.command, roomId: c.command.roomId, ready: true });
  assert.deepEqual(await error, ['INVALID_INPUT']);
  assert.equal(s.rooms.find(c.command.roomId).snapshot().lobby.players.length, 1);
});

test('host exit closes only its own room and client exit preserves the host', async (t) => {
  const s = await host(t); const a = await create(t, s); const b = await join(t, s, a.command.roomId); const c = await create(t, s);
  b.socket.emit('player:leave'); await once(b.socket, 'disconnect'); await wait(30);
  assert.equal(s.rooms.find(a.command.roomId).arena.players.size, 1);
  const d = await join(t, s, a.command.roomId); const closed = once(d.socket, 'network:error');
  a.socket.emit('player:leave'); assert.deepEqual(await closed, ['ROOM_CLOSED']);
  assert.equal(s.rooms.find(a.command.roomId), 'NO_ROOM');
  assert.equal(s.rooms.find(c.command.roomId).arena.players.size, 1);
});

test('brief host loss restores host identity but expiry closes the room', async (t) => {
  const s = await host(t); const a = await create(t, s); const b = await join(t, s, a.command.roomId);
  const room = s.rooms.find(a.command.roomId);
  a.socket.io.engine.close(); await wait(80);
  assert.equal(room.arena.players.get(a.welcome.id).connected, false);
  const resumed = await join(t, s, room.id, 'Chris', a.welcome.token);
  assert.equal(resumed.welcome.id, room.hostId); assert.notEqual(resumed.welcome.epoch, a.welcome.epoch);
  resumed.socket.io.engine.close(); await wait(80);
  const closed = once(b.socket, 'network:error');
  s.rooms.step(performance.now() + NET.recoveryMs + 1);
  assert.deepEqual(await closed, ['ROOM_CLOSED']); assert.equal(s.rooms.rooms.size, 0);
});

test('lobby freezes gameplay, optional readiness works and finished matches return to an unready lobby', async (t) => {
  const s = await host(t, { mode: 'ffa', countdownTicks: 1, durationTicks: 6, eliminationLimit: 30 });
  const a = await create(t, s, { requireReady: false }); const b = await join(t, s);
  const room = s.rooms.find(a.command.roomId); const original = room.arena.players.get(a.welcome.id).controller.state.x;
  a.socket.emit('player:active', { epoch: a.welcome.epoch, active: true });
  a.socket.emit('player:input', { epoch: a.welcome.epoch, commands: [{ seq: 1, forward: 1, right: 0, yaw: 0, pitch: 0, sprint: true, jump: true }] });
  await wait(100); assert.equal(room.arena.players.get(a.welcome.id).controller.state.x, original);
  assert.equal(room.arena.match, null);
  a.socket.emit('lobby:start', a.command);
  for (let i = 0; !room.arena.match?.ended && i < 100; i++) await wait(20);
  assert.ok(room.arena.match?.ended); assert.ok(validSnapshot(room.snapshot()));
  b.socket.emit('lobby:return', b.command); await wait(40);
  assert.equal(room.snapshot().lobby.phase, 'LOBBY'); assert.ok(room.snapshot().lobby.players.every((p) => !p.ready));
  assert.equal(room.arena.players.get(a.welcome.id).active, false);
});

test('room settings, unknown IDs and global room capacity are bounded', async (t) => {
  const s = await host(t); await assert.rejects(join(t, s), /NO_ROOM/);
  await assert.rejects(create(t, s, { maxPlayers: 99 }), /INVALID_INPUT/);
  await assert.rejects(create(t, s, { mode: 'tdm' }), /INVALID_INPUT/);
  await assert.rejects(join(t, s, '../../oops'), /INVALID_INPUT/);
  for (let i = 0; i < 4; i++) await create(t, s);
  await assert.rejects(create(t, s), /ROOM_LIMIT/);
  assert.equal(s.rooms.rooms.size, 4);
});

test('concurrent room allocations stay bounded and disposal prevents late allocations', async (t) => {
  const registry = new RoomRegistry(() => [], () => {}); t.after(() => registry.dispose());
  const results = await Promise.all(Array.from({ length: 8 }, () => registry.create(settings)));
  assert.equal(results.filter((r) => r === 'ROOM_LIMIT').length, 4); assert.equal(registry.rooms.size, 4);
  registry.dispose(); assert.equal(registry.rooms.size, 0);
  assert.equal(await registry.create(settings), 'ROOM_CLOSED');
  const pending = new RoomRegistry(() => [], () => {});
  const creating = pending.create(settings); pending.dispose();
  assert.equal(await creating, 'ROOM_CLOSED'); assert.equal(pending.rooms.size, 0);
});

test('room combat awards authoritative damage and score without crossing room boundaries', async (t) => {
  const s = await host(t, { mode: 'ffa', countdownTicks: 1, durationTicks: 6000, eliminationLimit: 30 });
  const a = await create(t, s, { requireReady: false }); const b = await join(t, s, a.command.roomId);
  const c = await create(t, s); const separate = s.rooms.find(c.command.roomId);
  a.socket.emit('lobby:start', a.command); await wait(50);
  const room = s.rooms.find(a.command.roomId); assert.ok(room.arena.match?.playing);
  const attacker = room.arena.players.get(a.welcome.id); const victim = room.arena.players.get(b.welcome.id);
  attacker.controller.reset({ id: 'fixture-a', position: [-2, 0, 0], yaw: -Math.PI / 2 });
  victim.controller.reset({ id: 'fixture-b', position: [2, 0, 0], yaw: Math.PI / 2 });
  a.socket.emit('player:active', { epoch: a.welcome.epoch, active: true });
  for (let seq = 1; seq <= 5; seq++) {
    a.socket.emit('player:input', { epoch: a.welcome.epoch, commands: [{ seq, forward: 0, right: 0, yaw: -Math.PI / 2, pitch: 0, sprint: false, jump: false,
      combat: { lifeId: room.arena.fighters.get(attacker.id).lifeId, fire: true, pressed: true, aim: false, reload: false, select: -1 } }] });
    await wait(170);
  }
  assert.equal(room.arena.fighters.get(victim.id).life.hp, 0); assert.equal(room.arena.fighters.get(attacker.id).eliminations, 1);
  assert.equal(separate.arena.fighters.get(c.welcome.id).life.hp, 100); assert.equal(separate.arena.match, null);
  const [snapshot] = await once(b.socket, 'world:state'); assert.ok(validSnapshot(snapshot));
  assert.equal(snapshot.combat.fighters.find((f) => f.id === attacker.id).eliminations, 1);
  assert.ok(!snapshot.players.some((p) => p.id === c.welcome.id));
});
