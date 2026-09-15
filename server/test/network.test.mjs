import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { io } from 'socket.io-client';
import { createApp } from '../dist/http/app.js';
import { createMovementNetwork } from '../dist/network/createMovementNetwork.js';
import { NETWORK_VERSION, NET, validSnapshot, validWelcome } from '../../shared/dist/network/protocol.js';

async function host(t) {
  const http = createServer(createApp()); const network = await createMovementNetwork(http);
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  t.after(() => network.close());
  return { ...network, url: `http://127.0.0.1:${http.address().port}` };
}
async function peer(t, url, name = 'Chris', extra = {}) {
  const socket = io(url, { transports: ['websocket'], autoConnect: false, reconnection: false, auth: { version: NETWORK_VERSION, name, ...extra } });
  t.after(() => socket.disconnect()); socket.on('network:probe', (ack) => ack());
  const welcome = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Welcome timeout')), 4000);
    const done = (fn, value) => { clearTimeout(timeout); fn(value); };
    socket.once('network:welcome', (value) => done(resolve, value));
    socket.once('network:error', (value) => done(reject, new Error(value)));
    socket.once('connect_error', (value) => done(reject, value));
    socket.connect();
  });
  return { socket, welcome };
}
const command = (seq, extra = {}) => ({ seq, forward: 1, right: 0, yaw: 0, pitch: 0, sprint: false, jump: false, ...extra });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('two real sockets receive distinct server identities and the same bounded world without exposing resume tokens', async (t) => {
  const server = await host(t); const a = await peer(t, server.url); const b = await peer(t, server.url, 'Lucas');
  assert.ok(validWelcome(a.welcome)); assert.ok(validWelcome(b.welcome)); assert.notEqual(a.welcome.id, b.welcome.id);
  const [snapshot] = await once(a.socket, 'world:state'); assert.ok(validSnapshot(snapshot)); assert.equal(snapshot.players.length, 2);
  assert.ok(snapshot.players.some((p) => p.id === b.welcome.id));
  assert.ok(!JSON.stringify(snapshot).includes(a.welcome.token)); assert.ok(!JSON.stringify(snapshot).includes(b.welcome.token));
});

test('network rejects incompatible versions and invalid names before allocating a player', async (t) => {
  const server = await host(t);
  await assert.rejects(peer(t, server.url, 'Chris', { version: 999 }), /INCOMPATIBLE/);
  await assert.rejects(peer(t, server.url, 'x'.repeat(21)), /INVALID_NAME/);
  await assert.rejects(peer(t, server.url, 'Chris\u0000'), /INVALID_NAME/);
  assert.equal(server.arena.players.size, 0);
});

test('shared arena admits eight players, reports full and frees an explicit disconnect immediately', async (t) => {
  const server = await host(t); const peers = [];
  for (let i = 0; i < NET.players; i++) peers.push(await peer(t, server.url, `P${i}`));
  await assert.rejects(peer(t, server.url, 'Extra'), /FULL/);
  peers[0].socket.emit('player:leave'); await once(peers[0].socket, 'disconnect'); await wait(30);
  const replacement = await peer(t, server.url, 'New'); assert.notEqual(replacement.welcome.id, peers[0].welcome.id);
  assert.equal(server.arena.players.size, 8);
});

test('real inputs move only their owner, snapshots acknowledge sequences and paused players do not pause the server', async (t) => {
  const server = await host(t); const a = await peer(t, server.url); const b = await peer(t, server.url, 'Lucas');
  for (let attempt = 0; !server.arena.match?.playing && attempt < 200; attempt++) await wait(20);
  assert.ok(server.arena.match?.playing);
  const start = { ...server.arena.players.get(a.welcome.id).controller.state };
  a.socket.emit('player:active', { epoch: a.welcome.epoch, active: true });
  for (let seq = 1; seq <= 60; seq += 2) {
    a.socket.emit('player:input', { epoch: a.welcome.epoch, commands: [command(seq, { right: 1, forward: 0 }), command(seq + 1, { right: 1, forward: 0 })] });
    await wait(34);
  }
  const moved = server.arena.players.get(a.welcome.id);
  for (let attempt = 0; moved.ack < 60 && attempt < 50; attempt++) await wait(20);
  assert.ok(moved.controller.state.x > start.x + 3); assert.equal(moved.ack, 60);
  a.socket.emit('player:active', { epoch: a.welcome.epoch, active: false }); await wait(100);
  const x = moved.controller.state.x; const tick = server.arena.tick;
  await wait(200); assert.equal(moved.controller.state.x, x); assert.ok(server.arena.tick > tick + 8);
  assert.equal(server.arena.players.get(b.welcome.id).ack, 0);
  assert.notEqual(moved.pingMs, null);
});

test('position injection, duplicate sequences and oversized batches cannot alter authoritative state', async (t) => {
  const server = await host(t);
  for (const kind of ['position', 'duplicate', 'oversized']) {
    const p = await peer(t, server.url, kind);
    p.socket.emit('player:active', { epoch: p.welcome.epoch, active: true });
    if (kind === 'duplicate') p.socket.emit('player:input', { epoch: p.welcome.epoch, commands: [command(1)] });
    const error = once(p.socket, 'network:error');
    p.socket.emit('player:input', { epoch: p.welcome.epoch, commands: kind === 'oversized' ? Array.from({ length: 5 }, (_, i) => command(i + 1)) : [command(1, kind === 'position' ? { x: 999, hp: 999 } : {})] });
    assert.deepEqual(await error, ['INVALID_INPUT']); await wait(30); assert.equal(server.arena.players.has(p.welcome.id), false);
  }
});

test('brief transport loss reserves identity, resumes with a new epoch and refuses reuse while connected', async (t) => {
  const server = await host(t); const a = await peer(t, server.url);
  await assert.rejects(peer(t, server.url, 'Hijack', { token: a.welcome.token }), /IN_USE/);
  a.socket.io.engine.close(); await wait(80);
  const retained = server.arena.players.get(a.welcome.id); assert.equal(retained.connected, false);
  const resumed = await peer(t, server.url, 'Chris', { token: a.welcome.token });
  assert.equal(resumed.welcome.id, a.welcome.id); assert.notEqual(resumed.welcome.epoch, a.welcome.epoch);
  const error = once(resumed.socket, 'network:error');
  resumed.socket.emit('player:input', { epoch: a.welcome.epoch, commands: [command(1)] });
  assert.deepEqual(await error, ['INVALID_INPUT']);
});

test('spammed events and unknown combat events disconnect instead of accepting client damage', async (t) => {
  const server = await host(t); const p = await peer(t, server.url);
  const error = once(p.socket, 'network:error');
  for (let i = 0; i < 25; i++) p.socket.emit('player:active', { epoch: p.welcome.epoch, active: true });
  assert.deepEqual(await error, ['RATE_LIMIT']);
  const q = await peer(t, server.url); const unsupported = once(q.socket, 'network:error');
  q.socket.emit('player:hit', { target: q.welcome.id, damage: 999 }); assert.deepEqual(await unsupported, ['INVALID_INPUT']);
});

test('real sockets replicate validated shots, death, score, reload and respawn without accepting client HP', async (t) => {
  const server = await host(t); const a = await peer(t, server.url); const b = await peer(t, server.url, 'Lucas');
  for (let attempt = 0; !server.arena.match?.playing && attempt < 200; attempt++) await wait(20);
  assert.ok(server.arena.match?.playing);
  const attacker = server.arena.players.get(a.welcome.id); const victim = server.arena.players.get(b.welcome.id);
  // Trusted test fixture positioning; no production endpoint exposes teleports or damage.
  attacker.controller.reset({ id: 'fixture-a', position: [-2, 0, 0], yaw: -Math.PI / 2 });
  victim.controller.reset({ id: 'fixture-b', position: [2, 0, 0], yaw: Math.PI / 2 });
  const fighter = server.arena.fighters.get(attacker.id); let latest;
  b.socket.on('world:state', (value) => { assert.ok(validSnapshot(value)); latest = value; });
  a.socket.emit('player:active', { epoch: a.welcome.epoch, active: true });
  let seq = 0;
  const send = (extra = {}) => a.socket.emit('player:input', { epoch: a.welcome.epoch, commands: [command(++seq, {
    forward: 0, yaw: -Math.PI / 2, combat: { lifeId: fighter.lifeId, fire: true, pressed: true, aim: false, select: -1, reload: false, ...extra },
  })] });
  for (let shot = 0; shot < 5; shot++) { send(); await wait(170); }
  for (let attempt = 0; latest?.combat.fighters.find((f) => f.id === victim.id).hp !== 0 && attempt < 50; attempt++) await wait(20);
  assert.equal(latest.combat.fighters.find((f) => f.id === victim.id).hp, 0);
  assert.equal(latest.combat.fighters.find((f) => f.id === attacker.id).eliminations, 1);
  assert.equal(latest.combat.fighters.find((f) => f.id === attacker.id).magazine, 25);
  assert.equal(latest.combat.feed[0].attacker.id, attacker.id);
  assert.ok(latest.combat.events.some((e) => e.type === 'elimination'));
  send({ fire: false, pressed: false, reload: true }); await wait(60);
  a.socket.emit('player:active', { epoch: a.welcome.epoch, active: false });
  await wait(1500); assert.equal(fighter.weapons.current.magazine, 30); assert.equal(fighter.weapons.current.reserve, 145);
  for (let attempt = 0; latest.combat.fighters.find((f) => f.id === victim.id).hp === 0 && attempt < 150; attempt++) await wait(20);
  assert.equal(latest.combat.fighters.find((f) => f.id === victim.id).hp, 100);
  const rejected = once(a.socket, 'network:error'); send({ hp: 999 });
  assert.deepEqual(await rejected, ['INVALID_INPUT']);
});
