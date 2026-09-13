import type { ArenaMap, MapSolid, Surface, Vec3 } from './types.js';

const box = (id: string, surface: Surface, position: Vec3, size: Vec3): MapSolid =>
  ({ id, shape: 'box', surface, position, size, yaw: 0 });

// One unit is one meter. The uninterrupted slab also underlies every ramp.
export const NEON_FACILITY: ArenaMap = {
  id: 'neon-facility', name: 'NEON FACILITY', size: [48, 40],
  solids: [
    box('floor', 'floor', [0, -0.5, 0], [48, 1, 40]),
    box('boundary-west', 'wall', [-24, 2.5, 0], [1, 5, 41]),
    box('boundary-east', 'wall', [24, 2.5, 0], [1, 5, 41]),
    box('boundary-north', 'wall', [0, 2.5, -20], [49, 5, 1]),
    box('boundary-south', 'wall', [0, 2.5, 20], [49, 5, 1]),
    ...[-1, 1].flatMap((side) => [-1, 1].map((end) =>
      box(`divider-${side}-${end}`, 'wall', [side * 14, 2, end * 8], [1, 4, 10]))),
    box('platform-north', 'platform', [0, 1.5, -15], [12, 3, 6]),
    box('platform-south', 'platform', [0, 1.5, 15], [12, 3, 6]),
    { id: 'ramp-north', shape: 'ramp', surface: 'ramp', position: [0, 0, -8], size: [4, 3, 8], yaw: Math.PI },
    { id: 'ramp-south', shape: 'ramp', surface: 'ramp', position: [0, 0, 8], size: [4, 3, 8], yaw: 0 },
    box('cover-core-west', 'cover', [-6, 0.8, -3], [3, 1.6, 3]),
    box('cover-core-east', 'cover', [6, 0.8, 3], [3, 1.6, 3]),
    ...[-1, 1].flatMap((side) => [-1, 1].map((end) =>
      box(`cover-corridor-${side}-${end}`, 'cover', [side * 19, 0.9, end * 7], [2.5, 1.8, 3]))),
  ],
  spawns: [
    { id: '01', position: [-20, 0, -16], yaw: -Math.PI * 0.75 },
    { id: '02', position: [20, 0, -16], yaw: Math.PI * 0.75 },
    { id: '03', position: [-20, 0, 16], yaw: -Math.PI * 0.25 },
    { id: '04', position: [20, 0, 16], yaw: Math.PI * 0.25 },
    { id: '05', position: [-20, 0, 0], yaw: -Math.PI * 0.5 },
    { id: '06', position: [20, 0, 0], yaw: Math.PI * 0.5 },
    { id: '07', position: [0, 3, -16], yaw: Math.PI },
    { id: '08', position: [0, 3, 16], yaw: 0 },
  ],
  sectors: [
    { name: 'CORE', position: [0, 0.025, 0], color: '#dbece4' },
    { name: 'SECTOR A', position: [-19, 0.025, -11], color: '#64efd2' },
    { name: 'SECTOR B', position: [19, 0.025, 11], color: '#ff897b' },
    { name: 'ENERGY ROOM', position: [0, 3.025, -14], color: '#f5d27a' },
  ],
};
