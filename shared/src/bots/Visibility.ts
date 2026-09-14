import RAPIER from '@dimforge/rapier3d-compat';
import type { PlayerPose } from '../simulation/player/movement.js';
import type { CombatActor } from './types.js';
import { distance } from './NavigationGraph.js';

export class Visibility {
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
  private staticOnly = (collider: RAPIER.Collider) => collider.parent() === null && !collider.isSensor();
  constructor(private world: RAPIER.World) {}
  clear(from: PlayerPose, to: PlayerPose) {
    const length = distance(from, to);
    if (length < 0.001) return true;
    Object.assign(this.ray.origin, { x: from.x, y: from.y + 1.5, z: from.z });
    Object.assign(this.ray.dir, { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length });
    return !this.world.castRay(this.ray, length, true, undefined, undefined, undefined, undefined, this.staticOnly);
  }
  detects(observer: CombatActor, target: CombatActor, range: number) {
    if (!target.life.alive || target === observer) return false;
    const a = observer.controller.state; const b = target.controller.state;
    const length = distance(a, b);
    if (length > range) return false;
    const facing = (-Math.sin(observer.yaw) * (b.x - a.x) - Math.cos(observer.yaw) * (b.z - a.z)) / Math.max(0.001, Math.hypot(b.x - a.x, b.z - a.z));
    return (length < 5 || facing >= Math.cos(Math.PI * 0.4)) && this.clear(a, b);
  }
}
