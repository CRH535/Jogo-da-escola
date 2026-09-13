export type Vec3 = readonly [x: number, y: number, z: number];
export type Surface = 'floor' | 'wall' | 'platform' | 'cover' | 'ramp';

export interface MapSolid {
  readonly id: string;
  readonly shape: 'box' | 'ramp';
  readonly surface: Surface;
  // Boxes use their center; ramps use the center of their bottom face.
  readonly position: Vec3;
  readonly size: Vec3;
  readonly yaw: number;
}

export interface SpawnPoint {
  readonly id: string;
  readonly position: Vec3; // Feet on the supporting surface; Y points up.
  readonly yaw: number;
}

export interface ArenaMap {
  readonly id: string;
  readonly name: string;
  readonly size: readonly [width: number, depth: number];
  readonly solids: readonly MapSolid[];
  readonly spawns: readonly SpawnPoint[];
  readonly sectors: readonly { readonly name: string; readonly position: Vec3; readonly color: string }[];
}
