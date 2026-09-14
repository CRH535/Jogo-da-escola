import type { ArenaMap } from '../maps/types.js';
import { distance } from './NavigationGraph.js';
import type { CombatActor } from './types.js';
import type { Visibility } from './Visibility.js';

export function selectSpawn(map: ArenaMap, actors: readonly CombatActor[], respawning: CombatActor, visibility: Visibility) {
  let best = map.spawns[0]!; let bestScore = -Infinity;
  for (const spawn of map.spawns) {
    const pose = { x: spawn.position[0], y: spawn.position[1], z: spawn.position[2] };
    let nearest = 60; let visible = 0;
    for (const actor of actors) {
      if (actor === respawning || !actor.life.alive) continue;
      nearest = Math.min(nearest, distance(pose, actor.controller.state));
      if (visibility.clear(pose, actor.controller.state)) visible++;
    }
    const score = nearest - visible * 12 - (nearest < 4 ? 1000 : 0);
    if (score > bestScore) { best = spawn; bestScore = score; }
  }
  return best;
}
