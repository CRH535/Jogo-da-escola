import type { Vec3 } from '../maps/types.js';

export const TRAINING_TARGETS: readonly { id: string; position: Vec3 }[] = [
  { id: 'T-01', position: [0, 4.6, 8] },
  { id: 'T-02', position: [-8, 1.3, -6] },
  { id: 'T-03', position: [8, 1.3, -6] },
  { id: 'T-04', position: [0, 4.6, -16] },
];
export const TARGET_HALF_SIZE: Vec3 = [0.55, 0.9, 0.28];
export const ENERGY_FIELD = { x: 0, z: 0, radius: 2, height: 2.5, damage: 25, interval: 30 } as const;
