import { test } from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { NEON_FACILITY as map, rampVertices, RAMP_INDICES } from '../dist/maps/index.js';
import { createMapWorld } from '../dist/physics/createMapWorld.js';

const rotation = { x: 0, y: 0, z: 0, w: 1 };
const centerHeight = 0.9;
const near = (actual, expected, epsilon = 0.025) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
async function fixture(t) {
  const physics = await createMapWorld(map);
  t.after(() => physics.dispose());
  return physics;
}
function floorAt(world, x, z) {
  const hit = world.castRay(new RAPIER.Ray({ x, y: 12, z }, { x: 0, y: -1, z: 0 }), 20, true);
  assert.ok(hit, `No supporting collider at ${x}, ${z}`);
  return 12 - hit.toi;
}

// A test-only capsule probes the layout with Rapier's move-and-slide implementation.
// Input handling, acceleration, jumping and the actual FPS controller belong to Stage 4.
function probe(world, [x, y, z]) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + centerHeight + 0.025, z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.35), body);
  const controller = world.createCharacterController(0.01);
  controller.enableSnapToGround(0.2);
  controller.setMaxSlopeClimbAngle(Math.PI / 4);
  controller.setMinSlopeSlideAngle(Math.PI / 4);
  world.step();
  function move(dx, dz, dy = -0.08) {
    controller.computeColliderMovement(collider, { x: dx, y: dy, z: dz });
    const next = controller.computedMovement();
    const pos = body.translation();
    body.setNextKinematicTranslation({ x: pos.x + next.x, y: pos.y + next.y, z: pos.z + next.z });
    world.step();
    return body.translation();
  }
  function walkTo(x, z) {
    for (let tick = 0; tick < 1500; tick++) {
      const pos = body.translation();
      const dx = x - pos.x; const dz = z - pos.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.06) return pos;
      const step = Math.min(0.1, distance);
      move(dx / distance * step, dz / distance * step);
    }
    assert.fail(`Blocked before ${x}, ${z}: ${JSON.stringify(body.translation())}`);
  }
  return { move, walkTo, position: () => body.translation() };
}

test('map has unique IDs, positive dimensions and matching static colliders', async (t) => {
  const { world, colliderIds } = await fixture(t);
  assert.equal(new Set(map.solids.map((solid) => solid.id)).size, map.solids.length);
  assert.equal(new Set(map.spawns.map((spawn) => spawn.id)).size, 8);
  assert.equal(world.colliders.len(), map.solids.length);
  assert.equal(colliderIds.size, map.solids.length);
  for (const solid of map.solids) {
    assert.ok(solid.size.every((value) => Number.isFinite(value) && value > 0));
    assert.ok(solid.position.every(Number.isFinite));
    const handle = [...colliderIds].find(([, id]) => id === solid.id)[0];
    const collider = world.getCollider(handle);
    const position = collider.translation();
    solid.position.forEach((expected, axis) => near([position.x, position.y, position.z][axis], expected));
  }
});

test('wedge mesh is closed, outward-wound and uses the expected slope', () => {
  const vertices = rampVertices([4, 3, 8]);
  const edges = new Map();
  const centroid = [0, 1, 4 / 3];
  for (let i = 0; i < RAMP_INDICES.length; i += 3) {
    const ids = RAMP_INDICES.slice(i, i + 3);
    const [a, b, c] = ids.map((id) => Array.from(vertices.slice(id * 3, id * 3 + 3)));
    const u = b.map((value, axis) => value - a[axis]);
    const v = c.map((value, axis) => value - a[axis]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    assert.ok(normal.reduce((sum, value, axis) => sum + value * (centroid[axis] - a[axis]), 0) < 0);
    ids.forEach((id, index) => {
      const key = [id, ids[(index + 1) % 3]].sort().join(':');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    });
  }
  assert.ok([...edges.values()].every((count) => count === 2));
});

test('floor has no gaps across the entire playable footprint', async (t) => {
  const { world } = await fixture(t);
  for (let x = -23; x <= 23; x += 2) {
    for (let z = -19; z <= 19; z += 2) assert.ok(floorAt(world, x, z) >= -0.001);
  }
});

for (const spawn of map.spawns) {
  test(`spawn ${spawn.id} supports a standing capsule without overlaps`, async (t) => {
    const { world } = await fixture(t);
    const [x, y, z] = spawn.position;
    near(floorAt(world, x, z), y);
    const overlap = world.intersectionWithShape({ x, y: y + centerHeight + 0.025, z }, rotation, new RAPIER.Capsule(0.55, 0.35));
    assert.equal(overlap, null);
    assert.ok(Math.abs(x) < map.size[0] / 2 - 1 && Math.abs(z) < map.size[1] / 2 - 1);
  });
}

for (const side of [-1, 1]) {
  test(`ramp ${side} has a continuous slope and capsule can ascend and descend`, async (t) => {
    const { world } = await fixture(t);
    for (let distance = 4; distance <= 12; distance += 0.5) near(floorAt(world, 0, distance * side), (distance - 4) * 3 / 8);
    near(floorAt(world, 0, 11.99 * side), 2.99625);
    near(floorAt(world, 0, 12.01 * side), 3);
    const capsule = probe(world, [0, 0, side * 2]);
    near(capsule.walkTo(0, side * 16).y, 3 + centerHeight, 0.06);
    near(capsule.walkTo(0, side * 2).y, centerHeight, 0.06);
  });
  test(`side corridor ${side} connects both ends and the central passage`, async (t) => {
    const { world } = await fixture(t);
    const capsule = probe(world, [side * 22, 0, -17]);
    near(capsule.walkTo(side * 22, 17).y, centerHeight, 0.06);
    capsule.walkTo(side * 22, 0);
    near(capsule.walkTo(0, 0).y, centerHeight, 0.06);
  });
  test(`rear passage ${side} connects the side corridors behind the platform`, async (t) => {
    const { world } = await fixture(t);
    const capsule = probe(world, [-21, 0, side * 18.75]);
    near(capsule.walkTo(21, side * 18.75).y, centerHeight, 0.06);
  });
}

for (const [name, start, dx, dz, axis, limit] of [
  ['east', [21, 0, 0], 20, 0, 'x', 23.15], ['west', [-21, 0, 0], -20, 0, 'x', -23.15],
  ['south', [10, 0, 17], 0, 20, 'z', 19.15], ['north', [10, 0, -17], 0, -20, 'z', -19.15],
]) {
  test(`boundary ${name} blocks even a large requested displacement`, async (t) => {
    const { world } = await fixture(t);
    const capsule = probe(world, start);
    const pos = capsule.move(dx, dz);
    near(pos[axis], limit, 0.06);
  });
}

test('covers and dividers are solid rather than visual-only geometry', async (t) => {
  const { world } = await fixture(t);
  const capsule = probe(world, [6, 0, 0]);
  near(capsule.move(0, 8).z, 1.15, 0.06);
  const hit = world.castRay(new RAPIER.Ray({ x: 10, y: 1, z: -8 }, { x: 1, y: 0, z: 0 }), 20, true);
  assert.ok(hit);
  near(hit.toi, 3.5);
});

test('gravity settles a falling body on the floor without tunneling', async (t) => {
  const { world } = await fixture(t);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(10, 10, 0).setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.ball(0.35), body);
  body.setLinvel({ x: 0, y: -100, z: 0 }, true);
  for (let tick = 0; tick < 240; tick++) world.step();
  near(body.translation().y, 0.35);
});

test('map worlds are independent and their disposal is idempotent', async () => {
  const first = await createMapWorld(map);
  const second = await createMapWorld(map);
  first.dispose(); first.dispose();
  assert.equal(first.colliderIds.size, 0);
  near(floorAt(second.world, 10, 0), 0);
  second.dispose(); second.dispose();
});
