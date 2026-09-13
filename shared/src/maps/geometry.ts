import type { Vec3 } from './types.js';

// Closed wedge rising along local +Z. Rendering and physics share these vertices.
export function rampVertices([width, height, depth]: Vec3): Float32Array {
  const x = width / 2;
  const z = depth / 2;
  return new Float32Array([
    -x, 0, -z, x, 0, -z, -x, 0, z, x, 0, z, -x, height, z, x, height, z,
  ]);
}

export const RAMP_INDICES = [
  0, 1, 2, 1, 3, 2, // bottom
  0, 4, 1, 1, 4, 5, // slope
  2, 3, 4, 3, 5, 4, // back
  0, 2, 4, 1, 5, 3, // sides
] as const;
