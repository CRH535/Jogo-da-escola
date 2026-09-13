import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMapWorld } from '../dist/physics/createMapWorld.js';
import { NEON_FACILITY } from '../dist/maps/index.js';
import { createPlayerController } from '../dist/simulation/index.js';
import { WEAPONS, WeaponManager, IDLE_COMBAT, Life, TrainingSession, damageAtDistance, ENERGY_FIELD } from '../dist/gameplay/index.js';

const idle = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
const press = { ...IDLE_COMBAT, pressed: true, fire: true };
function runWeapon(manager, ticks, input = IDLE_COMBAT, alive = true) {
  const events = [];
  for (let i = 0; i < ticks; i++) { const event = manager.step(input, alive); if (event) events.push(event); }
  return events;
}
async function range(t, position = [0, 3, 16], map = NEON_FACILITY) {
  const physics = await createMapWorld(map);
  const player = createPlayerController(physics.world, map, { id: 'test', position, yaw: 0 });
  const session = new TrainingSession(physics.world, player, () => 0);
  t.after(() => { session.dispose(); session.dispose(); player.dispose(); physics.dispose(); });
  function step(input = IDLE_COMBAT, yaw = 0, pitch = 0) {
    player.beforeStep(idle); physics.world.step(); player.afterStep(); session.step(input, yaw, pitch);
  }
  function run(ticks, input = IDLE_COMBAT) { for (let i = 0; i < ticks; i++) step(input); }
  return { physics, player, session, step, run };
}

test('NX-7 fires automatically at bounded cadence and stops at an empty magazine', () => {
  const manager = new WeaponManager();
  assert.equal(runWeapon(manager, 60, press).filter((x) => x === 'shot').length, 8);
  assert.equal(manager.current.magazine, 22);
  assert.equal(runWeapon(manager, 600, press).filter((x) => x === 'shot').length, 22);
  assert.equal(manager.current.magazine, 0);
  assert.equal(manager.current.reserve, 150);
});
for (const index of [1, 2]) {
  test(`${WEAPONS[index].name} fires once per press, honors cooldown and preserves its own ammunition`, () => {
    const manager = new WeaponManager();
    manager.step({ ...IDLE_COMBAT, select: index }, true); runWeapon(manager, 12);
    assert.equal(manager.step(press, true), 'shot');
    assert.equal(runWeapon(manager, 120, { ...IDLE_COMBAT, fire: true }).length, 0);
    assert.equal(manager.current.magazine, WEAPONS[index].magazine - 1);
    assert.equal(manager.step(press, true), 'shot');
    assert.equal(manager.step(press, true), null);
    assert.equal(manager.ammo[0].magazine, 30);
  });
}
test('switching cannot bypass fire cooldown and reload cancellation never awards ammunition', () => {
  const manager = new WeaponManager();
  manager.step(press, true);
  manager.step({ ...IDLE_COMBAT, reload: true }, true);
  runWeapon(manager, 20);
  manager.step({ ...press, select: 2 }, true);
  assert.equal(manager.reloadTicks, 0); assert.equal(manager.ammo[0].magazine, 29);
  runWeapon(manager, 12); manager.step(press, true);
  assert.equal(manager.step({ ...press, select: 0 }, true), null);
  assert.equal(manager.cooldown, 53);
  assert.equal(manager.current.magazine, 29);
});
test('reload duration is exact, transfers only needed rounds and does not create reserve', () => {
  const manager = new WeaponManager();
  manager.step(press, true);
  assert.equal(manager.step({ ...IDLE_COMBAT, reload: true }, true), 'reload');
  runWeapon(manager, 83, press); assert.equal(manager.current.magazine, 29);
  assert.equal(manager.step(IDLE_COMBAT, true), 'loaded');
  assert.deepEqual(manager.current, { magazine: 30, reserve: 149 });
  assert.equal(manager.step({ ...IDLE_COMBAT, reload: true }, true), null);
  manager.current.magazine = 0; manager.current.reserve = 2;
  manager.step({ ...IDLE_COMBAT, reload: true }, true); runWeapon(manager, 84);
  assert.deepEqual(manager.current, { magazine: 2, reserve: 0 });
});
test('empty reserve and invalid selection cannot corrupt weapon state', () => {
  const manager = new WeaponManager();
  manager.current.magazine = 0; manager.current.reserve = 0;
  for (const select of [-20, 3, 999, NaN, Infinity, 0.5]) {
    assert.equal(manager.step({ ...press, reload: true, select }, true), null);
    assert.equal(manager.selected, 0); assert.equal(manager.reloadTicks, 0);
  }
});
test('dead players cannot fire, reload, aim or switch equipment', () => {
  const manager = new WeaponManager();
  manager.step(press, true); manager.step({ ...IDLE_COMBAT, reload: true }, true);
  runWeapon(manager, 200, { ...press, reload: true, select: 2, aim: true }, false);
  assert.equal(manager.selected, 0); assert.equal(manager.current.magazine, 29);
  assert.equal(manager.reloadTicks, 0); assert.equal(manager.aiming, false);
});
test('secondary aim exists only on ARC-9 and reset restores all inventories', () => {
  const manager = new WeaponManager();
  manager.step({ ...press, aim: true }, true); assert.equal(manager.aiming, false);
  manager.step({ ...IDLE_COMBAT, select: 2, aim: true }, true); assert.equal(manager.aiming, true);
  manager.reset(); assert.equal(manager.aiming, false); assert.equal(manager.selected, 0);
  WEAPONS.forEach((weapon, i) => assert.deepEqual(manager.ammo[i], { magazine: weapon.magazine, reserve: weapon.reserve }));
});
test('short-range Scatter damage falls off strongly and all damage is range limited', () => {
  const scatter = WEAPONS[1];
  assert.equal(damageAtDistance(scatter, 2), 14);
  assert.ok(damageAtDistance(scatter, 21) < 4);
  for (const weapon of WEAPONS) {
    for (const distance of [-1, Infinity, NaN, weapon.range + 1]) assert.equal(damageAtDistance(weapon, distance), 0);
  }
});
test('life clamps damage, eliminates once and respawns exactly after 180 ticks', () => {
  const life = new Life();
  for (const damage of [0, -100, NaN, Infinity]) assert.equal(life.damage(damage), false);
  assert.equal(life.hp, 100); life.damage(25); assert.equal(life.hp, 75);
  life.damage(999); assert.equal(life.hp, 0); assert.equal(life.damage(1), false);
  for (let i = 0; i < 179; i++) assert.equal(life.step(), false);
  assert.equal(life.alive, false); assert.equal(life.step(), true);
  assert.equal(life.hp, 100); assert.equal(life.step(), false);
});
test('eye ray ignores the player capsule, damages a target and digital elimination occurs once', async (t) => {
  const sim = await range(t);
  sim.step(press); assert.equal(sim.session.targets[0].life.hp, 80);
  sim.run(32, press);
  assert.equal(sim.session.targets[0].life.hp, 0);
  assert.equal(sim.session.eliminations, 1); assert.equal(sim.session.hits, 5);
  assert.equal(sim.session.targets[0].collider.isEnabled(), false);
  sim.run(179); assert.equal(sim.session.targets[0].life.alive, false);
  sim.step(); assert.equal(sim.session.targets[0].life.hp, 100);
  assert.equal(sim.session.targets[0].collider.isEnabled(), true);
});
test('solid wall between eye and target prevents damage', async (t) => {
  const map = { ...NEON_FACILITY, solids: [...NEON_FACILITY.solids, {
    id: 'test-barrier', shape: 'box', surface: 'wall', position: [0, 4.6, 10], size: [4, 4, 1], yaw: 0,
  }] };
  const sim = await range(t, [0, 3, 16], map);
  sim.run(240, press);
  assert.equal(sim.session.hits, 0); assert.equal(sim.session.eliminations, 0);
  assert.equal(sim.session.targets[0].life.hp, 100);
  assert.equal(sim.session.weapons.current.magazine, 0);
});
test('wall ray returns the first surface and misses never create a hit marker', async (t) => {
  const sim = await range(t);
  sim.step(press, Math.PI / 2);
  const impact = sim.session.events.find((event) => event.type === 'impact');
  assert.equal(impact.hit, false); assert.ok(impact.x < -13 && impact.x > -24);
  assert.equal(sim.session.hits, 0);
});
test('Scatter emits exactly eight rays for one round and ARC-9 uses a separate magazine', async (t) => {
  const sim = await range(t);
  sim.step({ ...IDLE_COMBAT, select: 1 }); sim.run(12); sim.step(press);
  assert.equal(sim.session.events.filter((event) => event.type === 'impact').length, 8);
  assert.equal(sim.session.weapons.current.magazine, 5);
  sim.step({ ...IDLE_COMBAT, select: 2 }); sim.run(60); sim.step(press);
  assert.equal(sim.session.events.filter((event) => event.type === 'impact').length, 1);
  assert.equal(sim.session.weapons.current.magazine, 4);
});
test('hologram sensor does not block actual player movement', async (t) => {
  const sim = await range(t, [-8, 0, -4]);
  for (let i = 0; i < 60; i++) {
    sim.player.beforeStep({ ...idle, forward: 1 }); sim.physics.world.step(); sim.player.afterStep();
  }
  assert.ok(sim.player.state.z < -8); assert.equal(sim.player.recoveries, 0);
});
test('energy field deals timed damage, eliminates, blocks dead actions and respawns at a safe spawn', async (t) => {
  const sim = await range(t);
  sim.player.body.setTranslation({ x: 0, y: 0.91, z: 0 }, true); sim.player.afterStep();
  sim.run(29); assert.equal(sim.session.life.hp, 100);
  sim.step(); assert.equal(sim.session.life.hp, 75);
  sim.run(90); assert.equal(sim.session.life.hp, 0);
  assert.ok(sim.session.events.some((event) => event.type === 'death'));
  sim.run(179, press); assert.equal(sim.session.weapons.current.magazine, 30);
  assert.equal(sim.session.life.hp, 0);
  sim.step(press); assert.equal(sim.session.life.hp, 100);
  assert.ok(Math.hypot(sim.player.state.x - ENERGY_FIELD.x, sim.player.state.z - ENERGY_FIELD.z) > ENERGY_FIELD.radius + 2);
  assert.equal(sim.player.state.z, 16); assert.equal(sim.session.weapons.current.magazine, 30);
  assert.ok(sim.session.events.some((event) => event.type === 'respawn'));
});
test('leaving the field clears partial exposure and elevated positions are safe', async (t) => {
  const sim = await range(t);
  sim.player.body.setTranslation({ x: 0, y: 0.91, z: 0 }, true); sim.player.afterStep(); sim.run(20);
  sim.player.reset(); sim.run(20); assert.equal(sim.session.life.hp, 100);
  sim.player.body.setTranslation({ x: 0, y: 0.91, z: 0 }, true); sim.player.afterStep(); sim.run(20);
  assert.equal(sim.session.life.hp, 100);
  sim.player.reset(); sim.run(180); assert.equal(sim.session.life.hp, 100);
});
test('restart clears target deaths, player death, inventory and transient events', async (t) => {
  const sim = await range(t); sim.run(33, press); sim.session.damagePlayer(100);
  sim.session.reset(); sim.player.reset();
  assert.equal(sim.session.life.hp, 100); assert.equal(sim.session.weapons.current.magazine, 30);
  assert.equal(sim.session.hits, 0); assert.equal(sim.session.eliminations, 0); assert.equal(sim.session.events.length, 0);
  assert.ok(sim.session.targets.every((target) => target.life.alive && target.collider.isEnabled()));
});
