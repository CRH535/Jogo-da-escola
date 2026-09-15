import RAPIER from '@dimforge/rapier3d-compat';
import { rampVertices } from '../maps/geometry.js';
import type { ArenaMap } from '../maps/types.js';
export const PhysicsRay = RAPIER.Ray;

let initialization: Promise<void> | undefined;

export async function createMapWorld(map: ArenaMap) {
  initialization ??= RAPIER.init().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  await initialization;
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.timestep = 1 / 60;
  const colliderIds = new Map<number, string>();
  try {
    for (const solid of map.solids) {
      const [width, height, depth] = solid.size;
      const desc = solid.shape === 'box'
        ? RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2)
        : RAPIER.ColliderDesc.convexHull(rampVertices(solid.size));
      if (!desc) throw new Error(`Invalid collider: ${solid.id}`);
      const [x, y, z] = solid.position;
      desc.setTranslation(x, y, z).setRotation({ x: 0, y: Math.sin(solid.yaw / 2), z: 0, w: Math.cos(solid.yaw / 2) });
      desc.setFriction(0.7).setRestitution(0);
      colliderIds.set(world.createCollider(desc).handle, solid.id);
    }
    world.updateSceneQueries();
  } catch (error) {
    world.free();
    throw error;
  }
  let disposed = false;
  return {
    world, colliderIds,
    dispose() { if (!disposed) { disposed = true; world.free(); colliderIds.clear(); } },
  };
}

export type MapWorld = Awaited<ReturnType<typeof createMapWorld>>;
