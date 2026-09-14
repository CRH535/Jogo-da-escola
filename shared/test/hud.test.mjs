import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrainingStats, FEED_LIMIT, FEED_LIFETIME_TICKS } from '../dist/gameplay/TrainingStats.js';
import { sortScoreboard, formatDuration } from '../dist/gameplay/hud.js';
import { TrainingSession, IDLE_COMBAT } from '../dist/gameplay/index.js';
import { createPlayerController } from '../dist/simulation/index.js';
import { NEON_FACILITY } from '../dist/maps/index.js';
import { createMapWorld } from '../dist/physics/createMapWorld.js';

const ticks = (stats, count) => { for (let i = 0; i < count; i++) stats.step(); };
test('training HUD starts with one real local participant, no fake ping and no time limit', () => {
  const stats = new TrainingStats('Chris'); const hud = stats.snapshot();
  assert.deepEqual(hud.clock, { kind: 'elapsed', seconds: 0 });
  assert.equal(hud.score, 0); assert.equal(hud.deaths, 0); assert.deepEqual(hud.feed, []);
  assert.deepEqual(hud.players, [{ id: 'local-player', name: 'Chris', eliminations: 0, deaths: 0, score: 0, pingMs: null, local: true }]);
});
test('clock advances on simulation ticks only, crosses minute/hour boundaries and never ends training', () => {
  const stats = new TrainingStats();
  ticks(stats, 59); assert.equal(stats.snapshot().clock.seconds, 0);
  ticks(stats, 1); assert.equal(stats.snapshot().clock.seconds, 1);
  ticks(stats, 60 * 60 - 60); assert.equal(formatDuration(stats.snapshot().clock.seconds), '01:00');
  ticks(stats, 60 * 3600 - 60 * 60); assert.equal(formatDuration(stats.snapshot().clock.seconds), '1:00:00');
  assert.equal(stats.snapshot().clock.kind, 'elapsed');
});
test('each target elimination awards 100 points, has an identified victim and does not add a player', () => {
  const stats = new TrainingStats('Chris');
  stats.targetEliminated('T-01', 'NX-7 Pulse'); stats.targetEliminated('T-02', 'ARC-9');
  const hud = stats.snapshot();
  assert.equal(hud.score, 200); assert.equal(hud.players[0].eliminations, 2); assert.equal(hud.players.length, 1);
  assert.deepEqual(hud.feed.map((event) => [event.attacker.name, event.victim.name, event.equipment]), [['Chris', 'T-01', 'NX-7 Pulse'], ['Chris', 'T-02', 'ARC-9']]);
  assert.equal(hud.feed[0].victim.kind, 'target'); assert.notEqual(hud.feed[0].id, hud.feed[1].id);
});
test('environment elimination records one defeat without awarding the field or player points', () => {
  const stats = new TrainingStats('Chris'); stats.playerEliminated();
  const hud = stats.snapshot();
  assert.equal(hud.deaths, 1); assert.equal(hud.players[0].deaths, 1); assert.equal(hud.score, 0);
  assert.equal(hud.feed[0].attacker.kind, 'environment'); assert.equal(hud.feed[0].victim.name, 'Chris');
  assert.equal(hud.feed[0].equipment, null); assert.equal(hud.players.length, 1);
});
test('feed expires at exactly five simulation seconds, not merely when snapshots are read', () => {
  const stats = new TrainingStats(); stats.targetEliminated('T-01', 'NX-7 Pulse');
  for (let i = 0; i < 1000; i++) stats.snapshot();
  assert.equal(stats.snapshot().feed.length, 1);
  ticks(stats, FEED_LIFETIME_TICKS - 1); assert.equal(stats.snapshot().feed.length, 1);
  stats.step(); assert.equal(stats.snapshot().feed.length, 0); assert.equal(stats.snapshot().score, 100);
});
test('feed preserves chronological order, individual expiry and the four most recent events', () => {
  const stats = new TrainingStats();
  for (let i = 0; i < 10; i++) { stats.targetEliminated(`T-${i}`, 'NX-7 Pulse'); ticks(stats, 10); }
  assert.equal(stats.snapshot().feed.length, FEED_LIMIT);
  assert.deepEqual(stats.snapshot().feed.map((event) => event.victim.name), ['T-6', 'T-7', 'T-8', 'T-9']);
  ticks(stats, 260); assert.deepEqual(stats.snapshot().feed.map((event) => event.victim.name), ['T-7', 'T-8', 'T-9']);
  ticks(stats, 30); assert.equal(stats.snapshot().feed.length, 0);
});
test('old HUD snapshots are not mutated by new events, expiry, renaming or restart', () => {
  const stats = new TrainingStats('Chris'); stats.targetEliminated('T-01', 'NX-7 Pulse');
  const old = stats.snapshot(); stats.setPlayerName('Lucas'); stats.playerEliminated(); ticks(stats, 300); stats.reset();
  assert.equal(old.feed.length, 1); assert.equal(old.feed[0].attacker.name, 'Chris');
  assert.equal(old.players[0].name, 'Chris'); assert.equal(old.score, 100);
  assert.equal(stats.snapshot().players[0].name, 'Lucas');
});
test('restart clears time, score, defeats and feed while preserving identity and unique event IDs', () => {
  const stats = new TrainingStats('Chris'); stats.targetEliminated('T-01', 'NX-7 Pulse'); stats.playerEliminated(); ticks(stats, 90);
  const lastId = stats.snapshot().feed.at(-1).id; stats.reset();
  assert.equal(stats.snapshot().score, 0); assert.equal(stats.snapshot().deaths, 0);
  assert.equal(stats.snapshot().clock.seconds, 0); assert.deepEqual(stats.snapshot().feed, []);
  assert.equal(stats.snapshot().players[0].name, 'Chris');
  stats.targetEliminated('T-01', 'NX-7 Pulse'); assert.ok(stats.snapshot().feed[0].id > lastId);
});
test('scoreboard sorts by score, eliminations, fewer defeats and stable ID without mutating input', () => {
  const row = (id, score, eliminations, deaths) => Object.freeze({ id, score, eliminations, deaths, name: id, local: false, pingMs: 20 });
  const rows = Object.freeze([row('b', 100, 1, 0), row('z', 300, 3, 5), row('a', 100, 1, 0), row('c', 100, 2, 0), row('d', 100, 2, 1)]);
  assert.deepEqual(sortScoreboard(rows).map((player) => player.id), ['z', 'c', 'd', 'a', 'b']);
  assert.deepEqual(rows.map((player) => player.id), ['b', 'z', 'a', 'c', 'd']); assert.deepEqual(sortScoreboard([]), []);
});
test('clock formatting handles zero, invalid values, minute/hour rollover and bounded long sessions', () => {
  for (const [seconds, text] of [[0, '00:00'], [59.9, '00:59'], [60, '01:00'], [599, '09:59'], [600, '10:00'], [3599, '59:59'], [3600, '1:00:00'], [999999, '99:59:59'], [-10, '00:00'], [NaN, '00:00'], [Infinity, '00:00']]) assert.equal(formatDuration(seconds), text);
});

async function training(t) {
  const physics = await createMapWorld(NEON_FACILITY);
  const player = createPlayerController(physics.world, NEON_FACILITY, NEON_FACILITY.spawns[7]);
  const session = new TrainingSession(physics.world, player, () => 0);
  t.after(() => { session.dispose(); player.dispose(); physics.dispose(); });
  const step = (input = IDLE_COMBAT) => {
    player.beforeStep({ forward: 0, right: 0, yaw: 0, sprint: false, jump: false }); physics.world.step(); player.afterStep(); session.step(input, 0, 0);
  };
  const run = (count, input = IDLE_COMBAT) => { for (let i = 0; i < count; i++) step(input); };
  return { session, run, step };
}
test('real target elimination feeds and scores exactly once, including multiple Scatter pellets', async (t) => {
  const sim = await training(t);
  sim.step({ ...IDLE_COMBAT, select: 1 }); sim.run(12); sim.step({ ...IDLE_COMBAT, pressed: true, fire: true });
  assert.equal(sim.session.eliminations, 1); assert.equal(sim.session.stats.snapshot().score, 100);
  assert.equal(sim.session.stats.snapshot().feed.length, 1); assert.equal(sim.session.stats.snapshot().feed[0].victim.id, 'T-01');
  sim.run(100); assert.equal(sim.session.stats.snapshot().feed.length, 1);
});
test('damage repeated on an eliminated player does not duplicate defeats or feed, and respawn retains score', async (t) => {
  const sim = await training(t);
  sim.run(33, { ...IDLE_COMBAT, fire: true, pressed: true });
  sim.session.damagePlayer(100); sim.session.damagePlayer(100);
  assert.equal(sim.session.stats.snapshot().deaths, 1); assert.equal(sim.session.stats.snapshot().feed.length, 2);
  sim.run(180); assert.equal(sim.session.life.hp, 100); assert.equal(sim.session.stats.snapshot().score, 100);
  assert.equal(sim.session.stats.snapshot().deaths, 1); assert.ok(sim.session.stats.snapshot().clock.seconds >= 3);
  sim.session.reset(); assert.equal(sim.session.stats.snapshot().score, 0); assert.deepEqual(sim.session.stats.snapshot().feed, []);
});
test('reload snapshot supplies the actual capacity and bounded progress without consuming extra ammo', async (t) => {
  const sim = await training(t); sim.step({ ...IDLE_COMBAT, fire: true, pressed: true }); sim.step({ ...IDLE_COMBAT, reload: true });
  assert.equal(sim.session.snapshot().capacity, 30); assert.equal(sim.session.snapshot().reloadProgress, 0);
  sim.run(42); assert.equal(sim.session.snapshot().reloadProgress, 0.5);
  sim.run(42); assert.equal(sim.session.snapshot().reloadProgress, 0); assert.equal(sim.session.snapshot().magazine, 30);
});
