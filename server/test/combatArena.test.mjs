import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMapWorld } from '@neon-strike/shared/physics';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import { validSnapshot, validCommand, INTERMISSION_TICKS } from '@neon-strike/shared/network';
import { CombatArena } from '../dist/game/CombatArena.js';

async function setup(t, rules = {}) {
  const arena = new CombatArena(await createMapWorld(NEON_FACILITY), { mode: 'ffa', countdownTicks: 3, durationTicks: 36000, eliminationLimit: 30, ...rules }, () => 0);
  t.after(() => arena.dispose());
  const a = arena.join('Chris'); const b = arena.join('Lucas');
  advance(arena, 3);
  for (const [p, x, yaw] of [[a, -2, -Math.PI / 2], [b, 2, Math.PI / 2]]) {
    p.controller.reset({ id: 'fixture', position: [x, 0, 0], yaw }); arena.setActive(p, true);
  }
  advance(arena, 2);
  return { arena, a, b, fa: arena.fighters.get(a.id), fb: arena.fighters.get(b.id) };
}
function advance(arena, count) { for (let i = 0; i < count; i++) arena.step(performance.now()); }
function queue(arena, p, action = {}, movement = {}) {
  const command = { seq: p.accepted + 1, forward: 0, right: 0, yaw: p.controller.state.yaw, pitch: 0, jump: false, sprint: false, ...movement,
    combat: { fire: false, pressed: false, reload: false, select: -1, aim: false, lifeId: arena.fighters.get(p.id).lifeId, ...action } };
  assert.ok(validCommand(command)); assert.ok(arena.input(p, { epoch: p.epoch, commands: [command] }));
}
function fire(arena, p, count = 1) { for (let i = 0; i < count; i++) { queue(arena, p, { fire: true, pressed: true }); advance(arena, 1); } }

test('online countdown waits for two players, freezes movement/actions and starts exactly on server ticks', async (t) => {
  const arena = new CombatArena(await createMapWorld(NEON_FACILITY)); t.after(() => arena.dispose());
  const a = arena.join('Chris'); advance(arena, 300);
  assert.equal(arena.snapshot().combat.match.state, 'WAITING'); assert.ok(validSnapshot(arena.snapshot()));
  arena.join('Lucas'); advance(arena, 1); arena.setActive(a, true);
  const x = a.controller.state.x;
  for (let i = 0; i < 178; i++) { queue(arena, a, { fire: true, pressed: true }, { forward: 1, sprint: true }); advance(arena, 1); }
  assert.equal(arena.snapshot().combat.match.state, 'COUNTDOWN'); assert.equal(a.controller.state.x, x); assert.equal(arena.fighters.get(a.id).weapons.current.magazine, 30);
  advance(arena, 1); assert.equal(arena.snapshot().combat.match.state, 'PLAYING'); assert.equal(arena.snapshot().combat.match.remainingSeconds, 600);
});

test('real server raycasts enforce ammo/cadence, hit life and award one elimination with a safe three-second respawn', async (t) => {
  const { arena, a, b, fa, fb } = await setup(t);
  const oldLife = fb.lifeId; fire(arena, a, 33);
  assert.equal(fa.weapons.current.magazine, 25); assert.equal(fa.projectiles, 5); assert.equal(fa.hits, 5);
  assert.equal(fb.life.hp, 0); assert.equal(fa.eliminations, 1); assert.equal(fb.deaths, 1); assert.equal(fb.life.respawnTicks, 180);
  const dead = { ...b.controller.state };
  for (let i = 0; i < 179; i++) { queue(arena, b, { fire: true, pressed: true }, { forward: 1, jump: true }); advance(arena, 1); }
  assert.equal(fb.life.hp, 0); assert.equal(fb.projectiles, 0); assert.equal(b.controller.state.x, dead.x);
  advance(arena, 1); assert.equal(fb.life.hp, 100); assert.equal(fb.lifeId, oldLife + 1); assert.equal(fb.weapons.current.magazine, 30);
  assert.ok(Math.hypot(b.controller.state.x - a.controller.state.x, b.controller.state.z - a.controller.state.z) > 10);
  queue(arena, b, { fire: true, pressed: true, lifeId: oldLife }, { forward: 1 }); advance(arena, 1);
  assert.equal(fb.projectiles, 0); assert.equal(fb.weapons.current.magazine, 30); assert.ok(validSnapshot(arena.snapshot()));
});

test('all three equipment profiles use authoritative spread, distance and wall-occluded hit tests', async (t) => {
  for (const selected of [0, 1, 2]) {
    const { arena, a, b, fa, fb } = await setup(t);
    queue(arena, a, { select: selected, aim: true }); advance(arena, 13); fire(arena, a);
    assert.equal(fa.weapons.selected, selected); assert.equal(fa.projectiles, selected === 1 ? 8 : 1); assert.ok(fb.life.hp < 100);
    fb.life.reset(); b.controller.collider.setEnabled(true);
    a.controller.reset({ id: 'wall-a', position: [-16, 0, -8], yaw: -Math.PI / 2 });
    b.controller.reset({ id: 'wall-b', position: [-12, 0, -8], yaw: Math.PI / 2 }); advance(arena, 60);
    fire(arena, a); assert.equal(fb.life.hp, 100); assert.ok(validSnapshot(arena.snapshot()));
  }
});

test('reload progresses on server time through the local menu, reserves stay bounded and reset events are not accepted', async (t) => {
  const { arena, a, fa } = await setup(t); fire(arena, a, 9); queue(arena, a, { reload: true }); advance(arena, 1);
  assert.equal(fa.weapons.reloadTicks, 84); arena.setActive(a, false); advance(arena, 84);
  assert.equal(fa.weapons.current.magazine, 30); assert.equal(fa.weapons.current.reserve, 148);
  assert.equal(validCommand({ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, sprint: false, jump: false, combat: { fire: true, pressed: true, select: 0, aim: false, reload: false, lifeId: 1, damage: 999 } }), false);
});

test('two shooters resolve on one server tick without client damage and pause gives no invulnerability', async (t) => {
  const { arena, a, b, fa, fb } = await setup(t);
  queue(arena, a, { fire: true, pressed: true }); queue(arena, b, { fire: true, pressed: true }); advance(arena, 1);
  assert.equal(fa.life.hp, 80); assert.equal(fb.life.hp, 80); assert.equal(fa.projectiles, 1); assert.equal(fb.projectiles, 1);
  arena.setActive(b, false); advance(arena, 8); fire(arena, a); assert.equal(fb.life.hp, 60);
});

test('brief reconnect preserves death/ammo/score, renews transport epoch and restores no dead collider', async (t) => {
  const { arena, a, b, fa, fb } = await setup(t); fire(arena, a, 33);
  const epoch = b.epoch; arena.disconnect(b, 100, false);
  const resumed = arena.join('Lucas', b.token, 150);
  assert.equal(resumed.id, b.id); assert.notEqual(resumed.epoch, epoch); assert.equal(fb.life.hp, 0);
  assert.equal(b.controller.collider.isEnabled(), false); assert.equal(fb.deaths, 1); assert.equal(fa.weapons.current.magazine, 25);
});

test('server kill limit freezes immutable results and automatically resets the round without client restart', async (t) => {
  const { arena, a, fa, fb } = await setup(t, { eliminationLimit: 1 }); fire(arena, a, 33);
  const result = arena.snapshot().combat.match.result;
  assert.equal(result.winnerId, a.id); assert.equal(result.reason, 'eliminations'); assert.equal(result.players[0].score, 100);
  assert.equal(result.players[0].hits, 5); assert.equal(result.players[0].projectiles, 5);
  const hp = fb.life.hp; const ammo = fa.weapons.current.magazine;
  fire(arena, a, 10); assert.equal(fb.life.hp, hp); assert.equal(fa.weapons.current.magazine, ammo);
  advance(arena, INTERMISSION_TICKS - 10);
  assert.equal(arena.snapshot().combat.match.state, 'COUNTDOWN'); assert.equal(fa.eliminations, 0); assert.equal(fb.life.hp, 100);
  assert.equal(fa.weapons.current.magazine, 30); assert.equal(result.players[0].score, 100);
  assert.ok(validSnapshot(arena.snapshot()));
});

test('server time limit ends even with inactive clients, while an empty arena resets its lifecycle', async (t) => {
  const { arena, a, b } = await setup(t, { durationTicks: 60 }); arena.setActive(a, false); arena.setActive(b, false);
  advance(arena, 58); assert.equal(arena.snapshot().combat.match.state, 'MATCH_END'); assert.equal(arena.snapshot().combat.match.result.reason, 'time');
  arena.remove(a); arena.remove(b); advance(arena, 1); assert.equal(arena.snapshot().combat.match.state, 'WAITING'); assert.equal(arena.fighters.size, 0);
});

test('combat snapshots reject impossible ammo, scores, event replays and malformed match state', async (t) => {
  const { arena, a } = await setup(t); fire(arena, a);
  const good = arena.snapshot(); assert.ok(validSnapshot(good));
  for (const mutate of [
    (s) => { s.combat.fighters[0].magazine = 31; },
    (s) => { s.combat.fighters[0].hp = Infinity; },
    (s) => { s.combat.fighters[0].hits = 99; },
    (s) => { s.combat.fighters[0].lifeId = 0; },
    (s) => { s.combat.fighters[1].id = s.combat.fighters[0].id; },
    (s) => { s.combat.events.push(s.combat.events[0]); },
    (s) => { s.combat.events[0].impacts[0].x = 999; },
    (s) => { s.combat.match.state = 'PAUSED'; },
    (s) => { s.combat.match.state = 'MATCH_END'; },
  ]) {
    const bad = structuredClone(good); mutate(bad); assert.equal(validSnapshot(bad), false);
  }
});
