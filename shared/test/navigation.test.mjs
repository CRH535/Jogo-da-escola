import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEON_FACILITY } from '../dist/maps/index.js';
import { createMapWorld } from '../dist/physics/createMapWorld.js';
import { createPlayerController } from '../dist/simulation/index.js';
import { NavigationGraph, distance } from '../dist/bots/NavigationGraph.js';

test('navigation derives connected clearance nodes and excludes walls, covers and platform cliffs', async () => {
  const physics = await createMapWorld(NEON_FACILITY);
  const nav = new NavigationGraph(physics, NEON_FACILITY);
  try {
    assert.ok(nav.points.length > 800 && nav.points.length < 1700);
    for (const id of ['14:8', '-6:-3', '19:7']) assert.equal(nav.graph.getNode(id), undefined);
    assert.equal(nav.graph.getLink('5:15', '6:15'), undefined);
    for (const from of NEON_FACILITY.spawns) for (const to of NEON_FACILITY.spawns) {
      const start = { x: from.position[0], y: from.position[1], z: from.position[2] };
      const end = { x: to.position[0], y: to.position[1], z: to.position[2] };
      const path = nav.path(start, end);
      assert.ok(path.length, `No route from ${from.id} to ${to.id}`);
      assert.ok(distance(path[0], start) < 0.1); assert.ok(distance(path.at(-1), end) < 0.1);
      for (let i = 1; i < path.length; i++) assert.ok(Math.abs(path[i].y - path[i - 1].y) <= 0.55);
    }
  } finally { nav.dispose(); physics.dispose(); }
});

test('real capsule follows every spawn pair through corridors and ramps without teleporting or falling', async () => {
  const physics = await createMapWorld(NEON_FACILITY);
  const nav = new NavigationGraph(physics, NEON_FACILITY);
  try {
    for (const from of NEON_FACILITY.spawns) for (const to of NEON_FACILITY.spawns) {
      if (from === to) continue;
      const player = createPlayerController(physics.world, NEON_FACILITY, from);
      try {
        const end = { x: to.position[0], y: to.position[1], z: to.position[2] };
        const path = nav.path(player.state, end); let cursor = 0;
        for (let tick = 0; tick < 3000 && cursor < path.length; tick++) {
          const point = path[cursor];
          const dx = point.x - player.state.x; const dz = point.z - player.state.z;
          const length = Math.hypot(dx, dz);
          if (length < 0.18 && Math.abs(point.y - player.state.y) < 0.25) { cursor++; continue; }
          player.beforeStep({ forward: Math.min(1, length / 0.5), right: 0, yaw: Math.atan2(-dx, -dz), sprint: false, jump: false });
          physics.world.step(); player.afterStep();
          assert.ok(player.state.y > -0.1 && player.state.y < 3.4);
        }
        assert.equal(player.recoveries, 0);
        assert.equal(cursor, path.length, `${from.id}->${to.id} blocked at ${JSON.stringify(player.state)}, next ${JSON.stringify(path[cursor])}`);
        assert.ok(distance(player.state, end) < 0.3);
      } finally { player.dispose(); }
    }
  } finally { nav.dispose(); physics.dispose(); }
});

test('navigation includes the ground-level rear passages behind both elevated platforms', async () => {
  const physics = await createMapWorld(NEON_FACILITY);
  const nav = new NavigationGraph(physics, NEON_FACILITY);
  try {
    for (const z of [-19, 19]) {
      const path = nav.path({ x: -12, y: 0, z }, { x: 12, y: 0, z });
      assert.ok(path.some((point) => point.x === 0 && point.z === z && point.y < 0.1), `Missing rear passage ${z}`);
      const player = createPlayerController(physics.world, NEON_FACILITY, { id: 'rear-test', position: [-12, 0, z], yaw: 0 });
      try {
        let cursor = 0;
        for (let tick = 0; tick < 1200 && cursor < path.length; tick++) {
          const point = path[cursor]; const dx = point.x - player.state.x; const dz = point.z - player.state.z;
          const length = Math.hypot(dx, dz);
          if (length < 0.18) { cursor++; continue; }
          player.beforeStep({ forward: Math.min(1, length / 0.5), right: 0, yaw: Math.atan2(-dx, -dz), sprint: false, jump: false });
          physics.world.step(); player.afterStep();
          assert.ok(player.state.y < 0.1 && Math.abs(player.state.z - z) < 0.2);
        }
        assert.equal(cursor, path.length); assert.equal(player.recoveries, 0);
      } finally { player.dispose(); }
    }
  } finally { nav.dispose(); physics.dispose(); }
});
