import RAPIER from '@dimforge/rapier3d-compat';
import createGraph from 'ngraph.graph';
import { aStar } from 'ngraph.path';
import type { ArenaMap } from '../maps/types.js';
import type { MapWorld } from '../physics/createMapWorld.js';
import type { PlayerPose } from '../simulation/player/movement.js';

export interface Waypoint extends PlayerPose { id: string }
const rotation = { x: 0, y: 0, z: 0, w: 1 };
export const distance = (a: PlayerPose, b: PlayerPose) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// A single walkable layer is sufficient for NEON FACILITY; bridges would need a navmesh.
export class NavigationGraph {
  readonly points: Waypoint[] = [];
  readonly graph = createGraph<Waypoint, number>();
  private avoid: readonly PlayerPose[] = [];
  private readonly finder;
  constructor(physics: MapWorld, map: ArenaMap) {
    const world = physics.world;
    const surfaces = new Map(map.solids.map((solid) => [solid.id, solid.surface]));
    const staticOnly = (collider: RAPIER.Collider) => physics.colliderIds.has(collider.handle);
    const ray = new RAPIER.Ray({ x: 0, y: 12, z: 0 }, { x: 0, y: -1, z: 0 });
    const probe = new RAPIER.Capsule(0.45, 0.45);
    const position = { x: 0, y: 0, z: 0 };
    for (let x = -map.size[0] / 2 + 1; x <= map.size[0] / 2 - 1; x++) {
      for (let z = -map.size[1] / 2 + 1; z <= map.size[1] / 2 - 1; z++) {
        ray.origin.x = x; ray.origin.z = z;
        const hit = world.castRay(ray, 14, true, undefined, undefined, undefined, undefined, staticOnly);
        if (!hit) continue;
        const surface = surfaces.get(physics.colliderIds.get(hit.collider.handle)!);
        if (surface !== 'floor' && surface !== 'ramp' && surface !== 'platform') continue;
        const y = 12 - hit.toi;
        let supported = true;
        for (const [dx, dz] of [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) {
          ray.origin.x = x + dx!; ray.origin.z = z + dz!;
          const support = world.castRay(ray, 14, true, undefined, undefined, undefined, undefined, staticOnly);
          if (!support || Math.abs(12 - support.toi - y) > 0.22) { supported = false; break; }
        }
        if (!supported) continue;
        Object.assign(position, { x, y: y + 1, z });
        if (world.intersectionWithShape(position, rotation, probe, undefined, undefined, undefined, undefined, staticOnly)) continue;
        const point = { id: `${x}:${z}`, x, y, z };
        this.points.push(point); this.graph.addNode(point.id, point);
      }
    }
    const canLink = (a: Waypoint, b: Waypoint) => Math.abs(a.y - b.y) <= 0.55;
    for (const point of this.points) {
      for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const next = this.graph.getNode(`${point.x + dx!}:${point.z + dz!}`)?.data;
        if (!next || !canLink(point, next)) continue;
        if (dx && dz) {
          const sideA = this.graph.getNode(`${point.x + dx}:${point.z}`)?.data;
          const sideB = this.graph.getNode(`${point.x}:${point.z + dz}`)?.data;
          if (!sideA || !sideB || !canLink(point, sideA) || !canLink(point, sideB) || !canLink(next, sideA) || !canLink(next, sideB)) continue;
        }
        this.graph.addLink(point.id, next.id, distance(point, next));
      }
    }
    this.finder = aStar(this.graph, {
      heuristic: (a, b) => distance(a.data, b.data),
      distance: (_a, b, link) => link.data + this.avoid.reduce((cost, actor) => cost + (distance(actor, b.data) < 1.35 ? 12 : 0), 0),
    });
    if (!this.points.length) throw new Error('Navigation graph has no walkable nodes');
  }
  nearest(pose: PlayerPose): Waypoint {
    let best = this.points[0]!; let score = Infinity;
    for (const point of this.points) {
      const next = distance(pose, point);
      if (next < score) { score = next; best = point; }
    }
    return best;
  }
  path(from: PlayerPose, to: PlayerPose, avoid: readonly PlayerPose[] = []): Waypoint[] {
    this.avoid = avoid;
    const result = this.finder.find(this.nearest(from).id, this.nearest(to).id).reverse().map((node) => node.data);
    this.avoid = [];
    return result;
  }
  dispose() { this.graph.clear(); this.points.length = 0; this.avoid = []; }
}
