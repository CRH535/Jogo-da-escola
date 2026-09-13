import {
  BoxGeometry, BufferGeometry, CanvasTexture, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RingGeometry, SRGBColorSpace,
  type Material,
} from 'three';
import { rampVertices, RAMP_INDICES, type ArenaMap, type Surface } from '@neon-strike/shared/maps';

export function buildMapMeshes(map: ArenaMap) {
  const root = new Group();
  const spawns = new Group();
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<CanvasTexture>();
  const ownGeometry = <T extends BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const ownMaterial = <T extends Material>(material: T): T => { materials.add(material); return material; };
  const cube = ownGeometry(new BoxGeometry(1, 1, 1));
  const palette: Record<Surface, MeshStandardMaterial> = {
    floor: ownMaterial(new MeshStandardMaterial({ color: '#485451', roughness: 0.9 })),
    wall: ownMaterial(new MeshStandardMaterial({ color: '#9aa6a3', roughness: 0.7, metalness: 0.25 })),
    platform: ownMaterial(new MeshStandardMaterial({ color: '#6e827c', roughness: 0.8 })),
    cover: ownMaterial(new MeshStandardMaterial({ color: '#906258', roughness: 0.7, metalness: 0.2 })),
    ramp: ownMaterial(new MeshStandardMaterial({ color: '#b4b59f', roughness: 0.85 })),
  };
  const mint = ownMaterial(new MeshBasicMaterial({ color: '#64efd2' }));
  const coral = ownMaterial(new MeshBasicMaterial({ color: '#ff897b' }));
  const gold = ownMaterial(new MeshBasicMaterial({ color: '#f5d27a' }));

  for (const solid of map.solids) {
    let geometry: BufferGeometry = cube;
    if (solid.shape === 'ramp') {
      const indexed = new BufferGeometry();
      indexed.setAttribute('position', new Float32BufferAttribute(rampVertices(solid.size), 3));
      indexed.setIndex([...RAMP_INDICES]);
      geometry = ownGeometry(indexed.toNonIndexed());
      indexed.dispose();
      geometry.computeVertexNormals();
    }
    const mesh = new Mesh(geometry, palette[solid.surface]);
    mesh.name = solid.id;
    mesh.position.fromArray(solid.position);
    mesh.rotation.y = solid.yaw;
    if (solid.shape === 'box') mesh.scale.fromArray(solid.size);
    mesh.castShadow = solid.surface !== 'floor';
    mesh.receiveShadow = true;
    root.add(mesh);

    if (solid.surface === 'wall' || solid.surface === 'cover' || solid.surface === 'platform') {
      const band = new Mesh(cube, solid.surface === 'platform' ? gold : solid.position[0] > 0 ? coral : mint);
      band.position.set(solid.position[0], solid.position[1] + solid.size[1] / 2 + 0.012, solid.position[2]);
      const alongZ = solid.surface === 'wall' && solid.size[2] > solid.size[0];
      band.scale.set(alongZ ? 0.15 : solid.size[0] * 0.93, 0.024, alongZ ? solid.size[2] * 0.93 : 0.15);
      if (solid.surface !== 'wall') band.position.z -= solid.size[2] / 2 - 0.1;
      root.add(band);
    }
  }

  const labelGeometry = ownGeometry(new PlaneGeometry(1, 1));
  function label(text: string, color: string, width: number, parent: Group, x: number, y: number, z: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = color;
    context.font = 'bold 60px Arial';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, 256, 64, 500);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    textures.add(texture);
    const material = ownMaterial(new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    const plane = new Mesh(labelGeometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.scale.set(width, width / 4, 1);
    plane.position.set(x, y, z);
    parent.add(plane);
  }
  for (const sector of map.sectors) label(sector.name, sector.color, 5, root, ...sector.position);
  const ringGeometry = ownGeometry(new RingGeometry(0.65, 0.76, 24));
  for (const spawn of map.spawns) {
    const [x, y, z] = spawn.position;
    const ring = new Mesh(ringGeometry, mint);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.03, z);
    spawns.add(ring);
    label(`SPAWN ${spawn.id}`, '#a5ffe6', 2.8, spawns, x, y + 0.035, z + 1.2);
  }
  root.add(spawns);
  return {
    root, spawns,
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      root.clear();
    },
  };
}
