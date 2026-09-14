import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEON_FACILITY } from '../dist/maps/index.js';
import { createMapWorld } from '../dist/physics/createMapWorld.js';
import { createPlayerController } from '../dist/simulation/index.js';
import { IDLE_COMBAT } from '../dist/gameplay/index.js';
import { BotSession, BOT_PROFILES, normalizeBotOptions } from '../dist/bots/index.js';
import { distance } from '../dist/bots/NavigationGraph.js';
import { selectSpawn } from '../dist/bots/SpawnManager.js';

const idle = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
const seeded = () => { let seed = 514; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; };
async function simulation(t, count = 1, difficulty = 'normal') {
  const physics = await createMapWorld(NEON_FACILITY);
  const player = createPlayerController(physics.world, NEON_FACILITY, NEON_FACILITY.spawns[7]);
  const session = new BotSession(physics, player, { count, difficulty }, seeded());
  t.after(() => { session.dispose(); session.dispose(); player.dispose(); physics.dispose(); });
  function step(input = IDLE_COMBAT, yaw = 0, pitch = 0) {
    if (session.life.alive) player.beforeStep(idle);
    session.beforePhysics(); physics.world.step(); player.afterStep(); session.afterPhysics(); session.step(input, yaw, pitch);
  }
  function run(ticks, input = IDLE_COMBAT, yaw = 0, pitch = 0) { for (let tick = 0; tick < ticks; tick++) step(input, yaw, pitch); }
  function place(actor, x, y, z, yaw = 0) {
    actor.controller.reset({ id: 'test', position: [x, y, z], yaw }); actor.yaw = yaw; actor.pitch = 0;
  }
  return { physics, player, session, step, run, place, local: session.actors[0], bot: session.bots[0] };
}

test('bot options are bounded and each difficulty has finite non-perfect aim and positive reaction delay', () => {
  assert.deepEqual(normalizeBotOptions({ count: 99, difficulty: 'impossible' }), { count: 7, difficulty: 'normal' });
  assert.equal(normalizeBotOptions({ count: NaN, difficulty: 'easy' }).count, 3);
  assert.equal(normalizeBotOptions({ count: -5, difficulty: 'hard' }).count, 1);
  for (const profile of Object.values(BOT_PROFILES)) { assert.ok(profile.reaction >= 18); assert.ok(profile.spread > 0); assert.ok(profile.speed <= 1); }
  assert.ok(BOT_PROFILES.easy.reaction > BOT_PROFILES.normal.reaction && BOT_PROFILES.normal.reaction > BOT_PROFILES.hard.reaction);
  assert.ok(BOT_PROFILES.easy.spread > BOT_PROFILES.normal.spread && BOT_PROFILES.normal.spread > BOT_PROFILES.hard.spread);
});
test('real bots own distinct IDs, capsules, life and finite ammunition; HUD counts only actual actors', async (t) => {
  const { session, physics } = await simulation(t, 7);
  assert.equal(new Set(session.actors.map((actor) => actor.id)).size, 8);
  assert.equal(physics.world.bodies.len(), 8);
  const rows = session.stats.snapshot().players;
  assert.equal(rows.length, 8); assert.equal(rows.filter((row) => row.bot).length, 7);
  for (const bot of session.bots) { assert.equal(bot.actor.life.hp, 100); assert.equal(bot.actor.weapons.current.magazine, 30); }
  assert.equal(session.stats.snapshot().mode, 'bots');
});
test('perception respects solid occlusion, range, facing and eliminated targets', async (t) => {
  const { session, place, bot, local } = await simulation(t);
  place(bot.actor, -17, 0, -8, -Math.PI / 2); place(local, -11, 0, -8);
  assert.equal(session.visibility.detects(bot.actor, local, 30), false);
  place(bot.actor, -17, 0, 0, -Math.PI / 2); place(local, -8, 0, 0);
  assert.equal(session.visibility.detects(bot.actor, local, 30), true);
  bot.actor.yaw = Math.PI / 2; assert.equal(session.visibility.detects(bot.actor, local, 30), false);
  bot.actor.yaw = -Math.PI / 2; assert.equal(session.visibility.detects(bot.actor, local, 5), false);
  local.life.damage(100); assert.equal(session.visibility.detects(bot.actor, local, 30), false);
});
test('brain patrols, acquires, reacts with delay, searches last known position and eventually forgets hidden targets', async (t) => {
  const { session, place, bot, local } = await simulation(t);
  place(bot.actor, -10, 0, 0, 0); place(local, -10, 0, -10);
  for (let i = 0; i < 12; i++) { bot.step(session.actors); assert.equal(bot.combat.fire, false); }
  assert.equal(bot.state, 'ATTACK'); assert.equal(bot.targetId, local.id);
  let fired = false;
  for (let i = 0; i < 90; i++) { bot.step(session.actors); fired ||= bot.combat.fire; }
  assert.ok(fired);
  place(local, -20, 0, -8);
  for (let i = 0; i < 12; i++) bot.step(session.actors);
  assert.equal(bot.state, 'SEARCH'); assert.equal(bot.combat.fire, false);
  for (let i = 0; i < 190; i++) bot.step(session.actors);
  assert.equal(bot.state, 'PATROL'); assert.equal(bot.targetId, null);
});
test('bots chase distant visible actors and retarget after elimination', async (t) => {
  const { session, place, bot, local } = await simulation(t, 2);
  place(bot.actor, -10, 0, -14, Math.PI); place(local, -10, 0, 14); place(session.actors[2], 20, 0, 16);
  for (let i = 0; i < 12; i++) bot.step(session.actors);
  assert.equal(bot.state, 'CHASE'); assert.equal(bot.targetId, local.id);
  local.life.damage(100); place(session.actors[2], -10, 0, -6);
  for (let i = 0; i < 12; i++) bot.step(session.actors);
  assert.equal(bot.targetId, session.actors[2].id); assert.equal(bot.state, 'ATTACK');
});
test('human eye rays hit bot capsules, award one elimination and retain score after exact three-second respawn', async (t) => {
  const { session, place, bot, local } = await simulation(t);
  place(local, 10, 0, 0); place(bot.actor, 10, 0, -8);
  for (let tick = 0; tick < 40; tick++) session.step({ ...IDLE_COMBAT, fire: true }, 0, -0.03);
  assert.equal(bot.actor.life.hp, 0); assert.equal(session.eliminations, 1);
  assert.equal(session.stats.snapshot().feed[0].victim.kind, 'bot');
  assert.equal(session.stats.snapshot().players[1].deaths, 1);
  const remaining = bot.actor.life.respawnTicks;
  for (let tick = 0; tick < remaining - 1; tick++) session.step(IDLE_COMBAT, 0, 0);
  assert.equal(bot.actor.life.hp, 0);
  session.step(IDLE_COMBAT, 0, 0); assert.equal(bot.actor.life.hp, 100);
  assert.ok(bot.actor.controller.collider.isEnabled()); assert.equal(session.stats.snapshot().score, 100);
});
test('all three human weapons use wall-occluded hits and the same inventory rules in bot sessions', async (t) => {
  const { session, place, bot, local } = await simulation(t);
  for (let selected = 0; selected < 3; selected++) {
    session.reset(); place(local, -17, 0, -8); place(bot.actor, -11, 0, -8);
    session.step({ ...IDLE_COMBAT, select: selected }, -Math.PI / 2, 0);
    for (let tick = 0; tick < 15; tick++) session.step(IDLE_COMBAT, -Math.PI / 2, 0);
    const before = session.weapons.current.magazine;
    session.step({ ...IDLE_COMBAT, fire: true, pressed: true }, -Math.PI / 2, 0);
    assert.equal(session.weapons.current.magazine, before - 1); assert.equal(bot.actor.life.hp, 100);
    assert.equal(session.hits, 0); assert.equal(session.eliminations, 0);
  }
});
test('bot damage awards bot kills, prevents duplicate death and ignores dead shooter actions', async (t) => {
  const { session, bot, local } = await simulation(t, 2);
  assert.ok(session.damage(local, bot.actor, 100));
  assert.equal(session.damage(local, bot.actor, 100), false);
  assert.equal(session.damage(bot.actor, local, 100), false);
  const hud = session.stats.snapshot(); assert.equal(hud.deaths, 1); assert.equal(hud.players[1].score, 100);
  assert.equal(hud.feed.length, 1); assert.equal(hud.feed[0].attacker.name, 'BOT-01');
  assert.equal(local.controller.collider.isEnabled(), false);
  bot.actor.life.damage(100); bot.step(session.actors);
  assert.equal(bot.state, 'RESPAWN'); assert.equal(bot.combat.fire, false); assert.equal(bot.movement.forward, 0);
});
test('safe respawn avoids an occupied visible spawn when covered alternatives exist', async (t) => {
  const { session, local, place, bot } = await simulation(t);
  place(bot.actor, 0, 3, 16);
  const spawn = selectSpawn(NEON_FACILITY, session.actors, local, session.visibility);
  const pose = { x: spawn.position[0], y: spawn.position[1], z: spawn.position[2] };
  assert.ok(distance(pose, bot.actor.controller.state) > 12);
  assert.equal(session.visibility.clear(pose, bot.actor.controller.state), false);
});
test('seven bots move, fight each other and respawn for two simulated minutes with bounded physics and scores', async (t) => {
  const { session, run, physics } = await simulation(t, 7);
  const original = session.bots.map((bot) => ({ ...bot.actor.controller.state }));
  const traveled = session.bots.map(() => 0);
  const last = original.map((pose) => ({ ...pose }));
  const states = new Set();
  for (let second = 0; second < 120; second++) {
    run(60);
    session.bots.forEach((bot, index) => {
      const pose = bot.actor.controller.state;
      states.add(bot.state);
      traveled[index] += Math.hypot(pose.x - last[index].x, pose.z - last[index].z); last[index] = { ...pose };
      assert.ok(Math.abs(pose.x) < 23.5 && Math.abs(pose.z) < 19.5 && pose.y >= -0.1 && pose.y < 4);
      assert.equal(bot.actor.controller.recoveries, 0);
      assert.ok(Math.hypot(pose.vx, pose.vz) <= 6.1, `${bot.actor.id} at ${second}s: ${JSON.stringify(pose)}`);
    });
    assert.equal(physics.world.bodies.len(), 8);
  }
  assert.ok(traveled.every((meters) => meters > 25), JSON.stringify(traveled));
  for (const state of ['PATROL', 'ATTACK', 'RESPAWN']) assert.ok(states.has(state), state);
  const rows = session.stats.snapshot().players;
  assert.ok(rows.slice(1).some((row) => row.eliminations > 0));
  assert.equal(rows.reduce((sum, row) => sum + row.eliminations, 0), rows.reduce((sum, row) => sum + row.deaths, 0));
  assert.ok(session.stats.snapshot().feed.length <= 4);
});
test('reset clears bot/player state without multiplying resources; disposal removes all bot bodies', async (t) => {
  const { session, run, physics } = await simulation(t, 7);
  run(1200); session.reset();
  assert.equal(session.stats.snapshot().clock.seconds, 0); assert.deepEqual(session.stats.snapshot().feed, []);
  for (const actor of session.actors) { assert.equal(actor.life.hp, 100); assert.equal(actor.weapons.current.magazine, 30); }
  for (const row of session.stats.snapshot().players) { assert.equal(row.score, 0); assert.equal(row.deaths, 0); }
  assert.equal(physics.world.bodies.len(), 8); session.dispose(); assert.equal(physics.world.bodies.len(), 1);
});

test('seven noncombat patrols make physical progress without long wall stalls or using respawn as navigation', async (t) => {
  const { session, run } = await simulation(t, 7);
  session.visibility.detects = () => false;
  const last = session.bots.map((bot) => ({ ...bot.actor.controller.state }));
  const stalled = Array(7).fill(0); const maximum = Array(7).fill(0); const traveled = Array(7).fill(0);
  for (let second = 0; second < 120; second++) {
    run(60);
    session.bots.forEach((bot, index) => {
      const pose = bot.actor.controller.state;
      const moved = Math.hypot(pose.x - last[index].x, pose.z - last[index].z);
      traveled[index] += moved; stalled[index] = moved < 0.3 ? stalled[index] + 1 : 0;
      maximum[index] = Math.max(maximum[index], stalled[index]); last[index] = { ...pose };
      assert.equal(bot.actor.life.hp, 100); assert.equal(bot.actor.controller.recoveries, 0);
    });
  }
  assert.ok(traveled.every((meters) => meters > 100), JSON.stringify(traveled));
  assert.ok(maximum.every((seconds) => seconds < 5), `Stalled seconds: ${maximum}`);
});
