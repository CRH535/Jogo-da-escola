import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchManager, FFA_RULES, accuracyPercent } from '../dist/match/MatchManager.js';
import { NEON_FACILITY } from '../dist/maps/index.js';
import { createMapWorld } from '../dist/physics/createMapWorld.js';
import { createPlayerController } from '../dist/simulation/index.js';
import { IDLE_COMBAT } from '../dist/gameplay/index.js';
import { BotSession } from '../dist/bots/index.js';

const row = (id, kills = 0, deaths = 0) => ({ id, name: id, eliminations: kills, deaths, score: kills * 100, pingMs: null, local: id === 'local-player', projectiles: 10, hits: 5 });
const start = (match) => { for (let i = 0; i < match.rules.countdownTicks; i++) match.advanceCountdown(); };
const tick = (match, players) => match.afterTick(Math.max(...players.map((p) => p.eliminations)), () => players);

test('FFA rules are immutable, validated and default to three seconds, ten minutes and thirty eliminations', () => {
  const match = new MatchManager();
  assert.deepEqual(match.rules, { mode: 'ffa', countdownTicks: 180, durationTicks: 36000, eliminationLimit: 30 });
  assert.ok(Object.isFrozen(FFA_RULES)); assert.ok(Object.isFrozen(match.rules));
  for (const bad of [0, -1, NaN, Infinity, 1.5]) for (const key of ['countdownTicks', 'durationTicks', 'eliminationLimit']) {
    assert.throws(() => new MatchManager({ ...FFA_RULES, [key]: bad }));
  }
  assert.throws(() => new MatchManager({ ...FFA_RULES, mode: 'tdm' }));
});

test('countdown lasts exactly 180 ticks without consuming match time and GO lasts 45 gameplay ticks', () => {
  const match = new MatchManager();
  for (let i = 0; i < 180; i++) {
    assert.equal(match.snapshot().countdown, Math.ceil((180 - i) / 60));
    tick(match, [row('local-player', 30)]);
    assert.equal(match.snapshot().remainingSeconds, 600); assert.equal(match.ended, false);
    match.advanceCountdown();
  }
  assert.ok(match.playing); assert.ok(match.snapshot().go);
  for (let i = 0; i < 45; i++) tick(match, [row('local-player')]);
  assert.equal(match.snapshot().go, false); assert.equal(match.snapshot().remainingSeconds, 600);
  for (let i = 0; i < 15; i++) tick(match, [row('local-player')]);
  assert.equal(match.snapshot().remainingSeconds, 599);
});

test('default match ends at exactly ten minutes, with deterministic ranking, frozen results and no extra roster allocations', () => {
  const match = new MatchManager(); start(match);
  let reads = 0;
  const players = [row('bot-b', 4, 2), row('local-player', 3), row('bot-a', 4, 2), row('bot-c', 4, 3)];
  const roster = () => { reads++; return players; };
  for (let i = 0; i < 35999; i++) match.afterTick(4, roster);
  assert.equal(reads, 0); assert.ok(match.playing); assert.equal(match.snapshot().remainingSeconds, 1);
  match.afterTick(4, roster);
  const result = match.snapshot().result;
  assert.equal(reads, 1); assert.ok(match.ended); assert.equal(match.snapshot().remainingSeconds, 0);
  assert.equal(result.reason, 'time'); assert.equal(result.elapsedSeconds, 600); assert.equal(result.winnerId, 'bot-a');
  assert.deepEqual(result.players.map((p) => p.id), ['bot-a', 'bot-b', 'bot-c', 'local-player']);
  players[2].name = 'changed'; assert.equal(result.players[0].name, 'bot-a');
  assert.throws(() => { result.players[0].score = 0; });
  for (let i = 0; i < 200; i++) { match.advanceCountdown(); match.afterTick(100, roster); }
  assert.equal(match.snapshot().result, result); assert.equal(reads, 1);
});

test('30th elimination wins on its tick, including the last time-limit tick, and reset starts a fresh countdown', () => {
  const match = new MatchManager({ ...FFA_RULES, durationTicks: 2 }); start(match);
  tick(match, [row('local-player', 29), row('bot-a', 20)]); assert.ok(match.playing);
  tick(match, [row('local-player', 30), row('bot-a', 20)]);
  assert.equal(match.snapshot().result.reason, 'eliminations'); assert.equal(match.snapshot().result.winnerId, 'local-player');
  match.reset(); assert.equal(match.snapshot().state, 'COUNTDOWN'); assert.equal(match.snapshot().countdown, 3);
  assert.equal(match.snapshot().result, null); assert.equal(match.snapshot().remainingSeconds, 1);
});

test('accuracy is bounded and reports zero before any projectile is fired', () => {
  assert.equal(accuracyPercent(0, 0), 0); assert.equal(accuracyPercent(5, 8), 63);
  assert.equal(accuracyPercent(10, 4), 100); assert.equal(accuracyPercent(-1, 4), 0);
});

async function arena(t, rules = FFA_RULES) {
  const physics = await createMapWorld(NEON_FACILITY);
  const player = createPlayerController(physics.world, NEON_FACILITY, NEON_FACILITY.spawns[7]);
  const session = new BotSession(physics, player, { count: 1, difficulty: 'easy' }, () => 0.5, rules);
  t.after(() => { session.dispose(); player.dispose(); physics.dispose(); });
  const local = session.actors[0]; const bot = session.actors[1];
  const step = (input = IDLE_COMBAT) => session.step(input, 0, -0.03);
  const run = (ticks, input) => { for (let i = 0; i < ticks; i++) step(input); };
  return { physics, player, session, local, bot, step, run };
}

test('matched bots reject damage, movement decisions, ammo actions and stat time during countdown', async (t) => {
  const { session, local, bot, step } = await arena(t);
  const poses = session.actors.map((actor) => ({ ...actor.controller.state }));
  for (let i = 0; i < 180; i++) {
    assert.equal(session.damage(bot, local, 100), false);
    session.beforePhysics(); session.afterPhysics(); step({ ...IDLE_COMBAT, fire: true, reload: true, select: 2 });
  }
  assert.ok(session.playing); assert.equal(session.weapons.current.magazine, 30); assert.equal(session.weapons.selected, 0);
  assert.equal(session.stats.snapshot().clock.seconds, 0); assert.equal(session.stats.snapshot().score, 0);
  assert.deepEqual(session.actors.map((actor) => ({ ...actor.controller.state })), poses);
});

test('real raycast ends a matched arena, freezes dead actors and stats, then restart clears every actor and result', async (t) => {
  const { session, local, bot, run, step, physics } = await arena(t, { ...FFA_RULES, eliminationLimit: 1 });
  run(180);
  local.controller.reset({ id: 'test', position: [10, 0, 0], yaw: 0 });
  bot.controller.reset({ id: 'test', position: [10, 0, -8], yaw: 0 });
  run(50, { ...IDLE_COMBAT, fire: true });
  const result = session.match.snapshot().result;
  assert.equal(result.winnerId, 'local-player'); assert.equal(result.players[0].score, 100);
  assert.equal(result.players[0].hits, 5); assert.equal(result.players[0].projectiles, 5);
  const frozen = JSON.stringify({ hud: session.stats.snapshot(), rows: session.matchRows(), life: bot.life, weapon: session.snapshot() });
  for (let i = 0; i < 300; i++) {
    session.beforePhysics(); session.afterPhysics(); step({ ...IDLE_COMBAT, fire: true, reload: true });
    assert.equal(session.damage(local, bot, 100), false);
  }
  assert.equal(JSON.stringify({ hud: session.stats.snapshot(), rows: session.matchRows(), life: bot.life, weapon: session.snapshot() }), frozen);
  assert.equal(session.events.length, 0); session.reset();
  assert.equal(session.match.snapshot().state, 'COUNTDOWN'); assert.equal(session.match.snapshot().result, null);
  assert.equal(session.stats.snapshot().score, 0); assert.equal(session.stats.snapshot().feed.length, 0);
  for (const actor of session.actors) { assert.equal(actor.life.hp, 100); assert.equal(actor.weapons.current.magazine, 30); assert.ok(actor.controller.collider.isEnabled()); }
  for (const actor of session.matchRows()) { assert.equal(actor.projectiles, 0); assert.equal(actor.hits, 0); }
  assert.equal(physics.world.bodies.len(), 2);
});

test('bot victory preserves the human defeat and pending respawn instead of respawning after the match', async (t) => {
  const { session, local, bot, run, step } = await arena(t, { ...FFA_RULES, eliminationLimit: 1 });
  run(180); assert.ok(session.damage(local, bot, 100)); step();
  const result = session.match.snapshot().result;
  assert.equal(result.winnerId, bot.id); assert.equal(result.players.find((p) => p.local).deaths, 1);
  const remaining = local.life.respawnTicks; run(300);
  assert.equal(local.life.respawnTicks, remaining); assert.equal(local.life.hp, 0);
  session.stats.setPlayerName('changed'); assert.equal(result.players.find((p) => p.local).name, 'Player');
});

test('accuracy tracks misses and scatter projectiles, not trigger pulls or reload attempts', async (t) => {
  const { session, run, step } = await arena(t);
  run(180); step({ ...IDLE_COMBAT, select: 1 }); run(20);
  step({ ...IDLE_COMBAT, fire: true, pressed: true });
  assert.equal(session.matchRows()[0].projectiles, 8); assert.equal(session.matchRows()[0].hits, 0);
  run(10, { ...IDLE_COMBAT, fire: true, reload: true });
  assert.equal(session.matchRows()[0].projectiles, 8);
});
