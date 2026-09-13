import { NEON_FACILITY, type Vec3 } from '@neon-strike/shared/maps';

export interface MapView { id: string; label: string; target: Vec3; offset: Vec3 }
export const MAP_VIEWS: readonly MapView[] = [
  { id: 'overview', label: 'Visão geral', target: [0, 0, 0], offset: [44, 55, 48] },
  { id: 'core', label: 'CORE', target: [0, 0, 0], offset: [14, 19, 18] },
  { id: 'sector-a', label: 'SECTOR A', target: [-18, 0, 0], offset: [9, 19, 21] },
  { id: 'sector-b', label: 'SECTOR B', target: [18, 0, 0], offset: [-9, 19, -21] },
  ...NEON_FACILITY.spawns.map((spawn) => ({
    id: `spawn-${spawn.id}`, label: `SPAWN ${spawn.id}`, target: spawn.position,
    offset: [spawn.position[0] > 0 ? -7 : 7, 12, spawn.position[2] > 0 ? -9 : 9] as Vec3,
  })),
];
