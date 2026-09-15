import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotBuffer, validCommand, validInput, validName, validSnapshot, validWelcome } from '../dist/network/protocol.js';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import { createMapWorld } from '@neon-strike/shared/physics';
import { createPlayerController } from '@neon-strike/shared/simulation';

const command = { seq: 1, forward: 1, right: 0, yaw: 0, pitch: 0, sprint: false, jump: false };
const pose = { x: 0, y: 0.01, z: 0, vx: 6, vy: -2, vz: 0, yaw: 0, grounded: true, jumpHeld: false };
const id = 'a'.repeat(36);
const snapshot = (tick, x = tick / 10, yaw = 0) => ({ tick, players: [{ id, name: 'Chris', slot: 0, connected: true, active: true, pingMs: 10, ack: tick, pitch: 0, pose: { ...pose, x, yaw } }] });

test('network schemas reject invalid fields, non-finite inputs, duplicate identities and unbounded data', () => {
  assert.ok(validCommand(command)); assert.ok(validName('João')); assert.ok(!validName(' x ')); assert.ok(!validName('a\u202eb'));
  for (const change of [{ seq: 0 }, { seq: 1.2 }, { forward: Infinity }, { right: 2 }, { yaw: NaN }, { pitch: 2 }, { jump: 1 }, { x: 10 }]) assert.ok(!validCommand({ ...command, ...change }));
  assert.ok(validInput({ epoch: id, commands: [command] }));
  assert.ok(!validInput({ epoch: id, commands: Array(5).fill(command) }));
  assert.ok(!validInput({ epoch: id, commands: [command], position: pose }));
  assert.ok(validSnapshot(snapshot(1)));
  const duplicate = snapshot(1); duplicate.players.push({ ...duplicate.players[0] }); assert.ok(!validSnapshot(duplicate));
  const invalid = snapshot(1); invalid.players[0].pose.x = 100; assert.ok(!validSnapshot(invalid));
  assert.ok(validWelcome({ id, epoch: id, token: 'a'.repeat(43), snapshot: snapshot(1) }));
  assert.ok(!validWelcome({ id: 'b'.repeat(36), epoch: id, token: 'a'.repeat(43), snapshot: snapshot(1) }));
});

test('snapshot interpolation uses 100 ms delay, shortest angle, bounded extrapolation and bounded storage', () => {
  const buffer = new SnapshotBuffer(); const out = {};
  assert.equal(buffer.sample(id, 0, out), false);
  buffer.push(snapshot(0, 0, 3.1), 0); buffer.push(snapshot(6, 0.6, -3.1), 100); buffer.push(snapshot(12, 1.2, -3.1), 200);
  assert.ok(buffer.sample(id, 150, out)); assert.equal(out.x, 0.6);
  assert.ok(buffer.sample(id, 250, out)); assert.ok(Math.abs(out.x - 0.9) < 1e-6);
  buffer.sample(id, 100000, out); assert.ok(Math.abs(out.x - 1.4) < 1e-6);
  assert.equal(buffer.sample('missing', 250, out), false);
  buffer.push(snapshot(3), 1000); assert.equal(buffer.size, 3);
  buffer.clear(); buffer.push(snapshot(0, 0, 3.1), 0); buffer.push(snapshot(6, 0.6, -3.1), 100);
  buffer.sample(id, 150, out); assert.ok(Math.abs(out.yaw - Math.PI) < 0.001);
  for (let i = 7; i < 100; i++) buffer.push(snapshot(i), i * 17);
  assert.equal(buffer.size, 32); buffer.clear(); assert.equal(buffer.size, 0);
});

test('restoring and replaying a checkpoint preserves collisions and a held jump exactly', async () => {
  const physics = await createMapWorld(NEON_FACILITY);
  const player = createPlayerController(physics.world, NEON_FACILITY, NEON_FACILITY.spawns[7], false);
  const step = (input) => { player.beforeStep(input); physics.world.step(); player.afterStep(); };
  try {
    step({ ...command, forward: 0 }); step({ ...command, forward: 0 });
    const held = { ...command, jump: true }; step(held);
    const checkpoint = player.checkpoint(); assert.equal(checkpoint.jumpHeld, true);
    for (let i = 0; i < 120; i++) step(held);
    const expected = player.checkpoint();
    player.restore(checkpoint);
    for (let i = 0; i < 120; i++) step(held);
    const actual = player.checkpoint();
    for (const axis of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.ok(Math.abs(actual[axis] - expected[axis]) < 1e-5, axis);
    assert.equal(actual.grounded, expected.grounded); assert.equal(actual.jumpHeld, true); assert.equal(player.recoveries, 0);
  } finally { player.dispose(); physics.dispose(); }
});

test('remote respawn snaps to the new life instead of interpolating across the map', () => {
  const buffer = new SnapshotBuffer(); const out = {};
  const before = snapshot(0, -20); const after = snapshot(6, 20);
  before.combat = { fighters: [{ id, lifeId: 1 }] };
  after.combat = { fighters: [{ id, lifeId: 2 }] };
  buffer.push(before, 0); buffer.push(after, 100);
  assert.ok(buffer.sample(id, 150, out)); assert.equal(out.x, 20);
});
