import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMapWorld } from '@neon-strike/shared/physics';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import { MovementArena } from '../dist/network/MovementArena.js';
import { NET } from '@neon-strike/shared/network';
const command = (seq, jump = false) => ({ seq, forward: 0, right: 0, yaw: 0, pitch: 0, sprint: false, jump });

test('transport reservations expire, free colliders and cannot resurrect an expired identity', async () => {
  const arena = new MovementArena(await createMapWorld(NEON_FACILITY));
  try {
    const p = arena.join('Chris', undefined, 0); const token = p.token;
    arena.disconnect(p, 0, false); assert.equal(p.controller.collider.isEnabled(), false);
    arena.step(NET.recoveryMs - 1); assert.equal(arena.players.size, 1);
    arena.step(NET.recoveryMs); assert.equal(arena.players.size, 0);
    assert.equal(arena.join('Chris', token, NET.recoveryMs + 1), 'EXPIRED');
    assert.equal(arena.join('Lucas', undefined, NET.recoveryMs + 1).slot, 0);
  } finally { arena.dispose(); }
});

test('input queue and per-tick processing bound speed and inactive players discard movement', async () => {
  const arena = new MovementArena(await createMapWorld(NEON_FACILITY));
  try {
    const p = arena.join('Chris'); arena.setActive(p, true);
    for (let seq = 1; seq <= 12; seq++) assert.ok(arena.input(p, { epoch: p.epoch, commands: [{ ...command(seq), right: 1, sprint: true }] }));
    assert.equal(arena.input(p, { epoch: p.epoch, commands: [command(13)] }), false);
    const before = p.controller.state.x; arena.step(0);
    assert.equal(p.ack, 1); assert.ok(p.controller.state.x - before <= 9 / 60 + 1e-5);
    arena.setActive(p, false); assert.equal(p.commands.length, 0); assert.equal(p.ack, 12);
    assert.ok(arena.input(p, { epoch: p.epoch, commands: [command(13)] })); assert.equal(p.ack, 13);
  } finally { arena.dispose(); }
});

test('missing input ticks never release a held jump and cause repeated automatic jumps', async () => {
  const arena = new MovementArena(await createMapWorld(NEON_FACILITY));
  try {
    const p = arena.join('Chris'); arena.step(0); arena.step(16); arena.setActive(p, true);
    let seq = 0; let launches = 0; let previousVy = 0;
    for (let tick = 0; tick < 180; tick++) {
      if (tick % 2 === 0) arena.input(p, { epoch: p.epoch, commands: [command(++seq, true)] });
      arena.step(tick * 17);
      if (p.controller.state.vy > 6 && previousVy <= 0) launches++;
      previousVy = p.controller.state.vy;
    }
    assert.equal(launches, 1); assert.ok(p.controller.state.grounded);
  } finally { arena.dispose(); }
});
