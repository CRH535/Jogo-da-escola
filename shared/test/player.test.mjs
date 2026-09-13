import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEON_FACILITY } from '../dist/maps/index.js';
import { createMapWorld } from '../dist/physics/createMapWorld.js';
import { createPlayerController, FixedStep, MOVEMENT } from '../dist/simulation/index.js';

const idle = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
const near = (actual, expected, tolerance = 0.03) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
async function simulation(t, position = [10, 0, 0], map = NEON_FACILITY) {
  const physics = await createMapWorld(map);
  const player = createPlayerController(physics.world, map, { id: 'test', position, yaw: 0 });
  t.after(() => { player.dispose(); player.dispose(); physics.dispose(); });
  function step(input = idle) { player.beforeStep(input); physics.world.step(); player.afterStep(); }
  function run(ticks, input = idle) { for (let tick = 0; tick < ticks; tick++) step(input); }
  function walkTo(x, z) {
    for (let tick = 0; tick < 1200; tick++) {
      const dx = x - player.state.x; const dz = z - player.state.z;
      if (Math.hypot(dx, dz) < 0.12) { run(20); return; }
      step({ ...idle, forward: 1, yaw: Math.atan2(-dx, -dz) });
    }
    assert.fail(`Blocked en route to ${x}, ${z}: ${JSON.stringify(player.state)}`);
  }
  run(4);
  return { physics, player, step, run, walkTo };
}

test('controller accelerates, reaches walking speed and brakes to a stop', async (t) => {
  const sim = await simulation(t);
  assert.equal(sim.player.state.grounded, true);
  sim.step({ ...idle, forward: 1 });
  assert.ok(-sim.player.state.vz > 0 && -sim.player.state.vz < MOVEMENT.walkSpeed);
  sim.run(30, { ...idle, forward: 1 });
  near(-sim.player.state.vz, MOVEMENT.walkSpeed);
  const z = sim.player.state.z;
  sim.run(20);
  near(sim.player.state.vz, 0);
  assert.ok(z - sim.player.state.z < 0.5);
});

test('sprint is capped and releasing Shift decelerates to walking speed', async (t) => {
  const sim = await simulation(t);
  sim.run(40, { ...idle, forward: 1, sprint: true });
  near(-sim.player.state.vz, MOVEMENT.sprintSpeed);
  sim.run(30, { ...idle, forward: 1 });
  near(-sim.player.state.vz, MOVEMENT.walkSpeed);
});

test('diagonals, oversized axes and opposing direction changes cannot boost speed', async (t) => {
  const sim = await simulation(t, [0, 0, 0]);
  for (const right of [1, -1, 900, -900]) {
    sim.run(20, { ...idle, forward: 600, right, sprint: true });
    assert.ok(Math.hypot(sim.player.state.vx, sim.player.state.vz) <= MOVEMENT.sprintSpeed + 0.01);
  }
});

test('yaw changes world direction while looking never changes the gravity axis', async (t) => {
  const sim = await simulation(t);
  sim.run(30, { ...idle, forward: 1, yaw: Math.PI / 2 });
  assert.ok(sim.player.state.x < 8);
  near(sim.player.state.z, 0);
  near(sim.player.state.y, MOVEMENT.skin);
});

test('non-finite input is normalized without corrupting the physics world', async (t) => {
  const sim = await simulation(t);
  sim.run(20, { ...idle, forward: NaN, right: Infinity, yaw: -Infinity });
  near(sim.player.state.x, 10); near(sim.player.state.z, 0);
  assert.ok(Object.values(sim.player.state).every((value) => typeof value !== 'number' || Number.isFinite(value)));
});

test('holding jump produces one jump and a new press after landing can jump again', async (t) => {
  const sim = await simulation(t);
  let highest = 0;
  let takeoffs = 0;
  let grounded = true;
  for (let tick = 0; tick < 180; tick++) {
    sim.step({ ...idle, jump: true });
    const state = sim.player.state;
    if (grounded && !state.grounded) takeoffs++;
    grounded = state.grounded; highest = Math.max(highest, state.y);
  }
  assert.equal(takeoffs, 1);
  assert.ok(highest > 1.2 && highest < 1.45);
  near(sim.player.state.y, MOVEMENT.skin);
  sim.step(); sim.step({ ...idle, jump: true });
  assert.equal(sim.player.state.grounded, false);
  assert.ok(sim.player.state.vy > 0);
});

test('repeated jump presses in midair do not reset vertical velocity', async (t) => {
  const sim = await simulation(t);
  sim.step({ ...idle, jump: true });
  let lastVelocity = sim.player.state.vy;
  for (let tick = 0; tick < 30; tick++) {
    sim.step({ ...idle, jump: tick % 2 === 0 });
    assert.ok(sim.player.state.vy <= lastVelocity);
    lastVelocity = sim.player.state.vy;
    assert.ok(sim.player.state.y < 1.45);
  }
});

test('jumping into a low ceiling stops upward motion and falls back to the floor', async (t) => {
  const map = { ...NEON_FACILITY, solids: [NEON_FACILITY.solids[0], {
    id: 'test-ceiling', shape: 'box', surface: 'wall', position: [10, 2.55, 0], size: [4, 0.3, 4], yaw: 0,
  }] };
  const sim = await simulation(t, [10, 0, 0], map);
  let highest = 0;
  for (let tick = 0; tick < 100; tick++) { sim.step({ ...idle, jump: true }); highest = Math.max(highest, sim.player.state.y); }
  assert.ok(highest > 0.4 && highest < 0.61);
  assert.equal(sim.player.state.grounded, true);
  near(sim.player.state.y, MOVEMENT.skin);
});

for (const side of [-1, 1]) {
  test(`actual controller climbs and descends ramp ${side} without sticking or falling through`, async (t) => {
    const sim = await simulation(t, [0, 0, side * 2]);
    sim.walkTo(0, side * 16);
    near(sim.player.state.y, 3 + MOVEMENT.skin, 0.05);
    sim.walkTo(0, side * 2);
    near(sim.player.state.y, MOVEMENT.skin, 0.05);
    assert.equal(sim.player.recoveries, 0);
  });
  test(`actual controller traverses side corridor ${side} and its center doorway`, async (t) => {
    const sim = await simulation(t, [side * 22, 0, -17]);
    sim.walkTo(side * 22, 17); sim.walkTo(side * 22, 0); sim.walkTo(0, 0);
    near(sim.player.state.y, MOVEMENT.skin, 0.05);
    assert.equal(sim.player.recoveries, 0);
  });
}

test('stepping off a platform applies gravity until landing without a midair jump', async (t) => {
  const sim = await simulation(t, [0, 3, 16]);
  sim.run(90, { ...idle, right: 1 });
  assert.ok(sim.player.state.x > 6);
  assert.equal(sim.player.state.grounded, false);
  sim.step({ ...idle, jump: true });
  assert.ok(sim.player.state.vy < 0);
  sim.run(100);
  assert.equal(sim.player.state.grounded, true);
  near(sim.player.state.y, MOVEMENT.skin, 0.05);
});

for (const [name, position, input, axis, expected] of [
  ['east', [21, 0, 0], { right: 1 }, 'x', 23.14],
  ['west', [-21, 0, 0], { right: -1 }, 'x', -23.14],
  ['south', [10, 0, 17], { forward: -1 }, 'z', 19.14],
  ['north', [10, 0, -17], { forward: 1 }, 'z', -19.14],
]) {
  test(`sprinting continuously at the ${name} boundary cannot pass through or climb it`, async (t) => {
    const sim = await simulation(t, position);
    sim.run(240, { ...idle, ...input, sprint: true });
    near(sim.player.state[axis], expected);
    near(sim.player.state.y, MOVEMENT.skin, 0.05);
    assert.equal(sim.player.recoveries, 0);
  });
}

test('diagonal input at a solid corner remains bounded and changing direction escapes', async (t) => {
  const sim = await simulation(t, [21, 0, 17]);
  sim.run(180, { ...idle, right: 1, forward: -1, sprint: true });
  near(sim.player.state.x, 23.14); near(sim.player.state.z, 19.14);
  near(sim.player.state.y, MOVEMENT.skin, 0.05);
  sim.run(60, { ...idle, right: -1, forward: 1 });
  assert.ok(sim.player.state.x < 20 && sim.player.state.z < 16);
});

test('cover blocks movement without autostepping onto a 1.6 meter obstacle', async (t) => {
  const sim = await simulation(t, [6, 0, 0]);
  sim.run(150, { ...idle, forward: -1, sprint: true });
  near(sim.player.state.z, 1.14); near(sim.player.state.y, MOVEMENT.skin, 0.05);
});

test('fall recovery resets pose and velocity to the configured spawn', async (t) => {
  const sim = await simulation(t);
  sim.player.body.setTranslation({ x: 10, y: -12, z: 0 }, true);
  sim.player.afterStep();
  near(sim.player.state.x, 10); near(sim.player.state.z, 0); near(sim.player.state.y, MOVEMENT.skin);
  near(sim.player.state.vy, 0); assert.equal(sim.player.recoveries, 1);
  sim.run(5); assert.equal(sim.player.state.grounded, true);
});

test('reset and clearing inputs leave no residual horizontal momentum', async (t) => {
  const sim = await simulation(t);
  sim.run(20, { ...idle, forward: 1 });
  sim.player.clearInput(); near(sim.player.state.vz, 0);
  sim.player.reset(); near(sim.player.state.z, 0); near(sim.player.previous.z, 0);
  sim.run(10); near(sim.player.state.z, 0);
});

test('30, 60, 120 and 144 render FPS produce the same fixed-step movement', async (t) => {
  const distances = [];
  for (const fps of [30, 60, 120, 144]) {
    const sim = await simulation(t);
    const clock = new FixedStep(); let ticks = 0;
    for (let frame = 0; frame < fps * 2; frame++) clock.advance(1 / fps, () => { ticks++; sim.step({ ...idle, forward: 1 }); });
    assert.equal(ticks, 120);
    assert.ok(clock.alpha >= 0 && clock.alpha < 1);
    distances.push(sim.player.state.z);
  }
  distances.forEach((distance) => near(distance, distances[0], 0.001));
});

test('frame stalls, invalid time and resume cannot accumulate an unlimited catch-up', () => {
  const clock = new FixedStep(); let ticks = 0;
  const step = () => ticks++;
  for (const elapsed of [NaN, Infinity, -1, 0]) assert.equal(clock.advance(elapsed, step), 0);
  assert.equal(clock.advance(60, step), 6);
  assert.ok(clock.alpha < 1);
  clock.reset(); assert.equal(clock.alpha, 0);
  clock.advance(1 / 60, step); assert.equal(ticks, 7);
});
