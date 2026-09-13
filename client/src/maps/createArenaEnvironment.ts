import { Color, DirectionalLight, HemisphereLight, Scene } from 'three';
import type { ArenaMap } from '@neon-strike/shared/maps';
import { buildMapMeshes } from './buildMapMeshes';

export function createArenaEnvironment(map: ArenaMap) {
  const scene = new Scene();
  scene.background = new Color('#111717');
  const meshes = buildMapMeshes(map);
  const sun = new DirectionalLight('#fff1db', 3);
  sun.position.set(-18, 36, 12);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 0.5, far: 100 });
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.03;
  scene.add(meshes.root, sun, new HemisphereLight('#f0fff8', '#65716a', 2));
  return {
    scene, meshes,
    dispose() { meshes.dispose(); sun.shadow.dispose(); scene.clear(); },
  };
}
