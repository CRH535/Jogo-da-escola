import { BoxGeometry, CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, Sprite, SpriteMaterial, type Scene } from 'three';
import { ENERGY_FIELD, TRAINING_TARGETS, type TrainingSession } from '@neon-strike/shared/gameplay';

export function createTrainingObjects(scene: Scene) {
  const root = new Group(); scene.add(root);
  const box = new BoxGeometry(1, 1, 1);
  const hologram = new MeshBasicMaterial({ color: '#62eed0', transparent: true, opacity: 0.65 });
  const frame = new MeshBasicMaterial({ color: '#a8fce7', wireframe: true, transparent: true, opacity: 0.25 });
  const bar = new MeshBasicMaterial({ color: '#c5ffdc' });
  const barBack = new MeshBasicMaterial({ color: '#273e39' });
  const warning = new MeshBasicMaterial({ color: '#ff8579', side: DoubleSide });
  const fill = new MeshBasicMaterial({ color: '#ff8579', transparent: true, opacity: 0.14, side: DoubleSide, depthWrite: false });
  const textures: CanvasTexture[] = []; const labels: SpriteMaterial[] = [];
  function label(text: string, color: string) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 80;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#101918d9'; context.fillRect(0, 0, 512, 80);
    context.fillStyle = color; context.font = 'bold 30px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, 256, 40);
    const texture = new CanvasTexture(canvas); const material = new SpriteMaterial({ map: texture, depthWrite: false });
    textures.push(texture); labels.push(material);
    const sprite = new Sprite(material); sprite.scale.set(2.8, 0.44, 1); return sprite;
  }
  const targets = TRAINING_TARGETS.map((target) => {
    const group = new Group(); group.position.set(...target.position); root.add(group);
    const part = (size: [number, number, number], position: [number, number, number], material = hologram) => {
      const mesh = new Mesh(box, material); mesh.scale.set(...size); mesh.position.set(...position); group.add(mesh); return mesh;
    };
    part([1.1, 1.8, 0.56], [0, 0, 0], frame);
    part([0.68, 0.65, 0.38], [0, 0.05, 0]); part([0.34, 0.34, 0.34], [0, 0.65, 0]);
    for (const side of [-1, 1]) { part([0.18, 0.5, 0.25], [side * 0.43, 0.06, 0]); part([0.22, 0.54, 0.25], [side * 0.2, -0.59, 0]); }
    part([1.1, 0.06, 0.02], [0, 1.01, 0], barBack);
    const health = part([1.1, 0.06, 0.025], [0, 1.01, 0.015], bar);
    const title = label(target.id, '#9effe3'); title.position.y = 1.36; title.scale.set(1.4, 0.22, 1); group.add(title);
    return { group, health };
  });
  const ringGeometry = new RingGeometry(ENERGY_FIELD.radius - 0.08, ENERGY_FIELD.radius, 48);
  const fillGeometry = new RingGeometry(0, ENERGY_FIELD.radius, 48);
  for (const [geometry, material] of [[ringGeometry, warning], [fillGeometry, fill]] as const) {
    const mesh = new Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(ENERGY_FIELD.x, 0.035, ENERGY_FIELD.z); root.add(mesh);
  }
  const danger = label('CAMPO INSTAVEL / DANO', '#ffb3a8'); danger.position.set(0, 0.8, 0); root.add(danger);
  return {
    update(session: TrainingSession) {
      targets.forEach((target, index) => {
        const life = session.targets[index]!.life;
        target.group.visible = life.alive;
        target.health.scale.x = 1.1 * life.hp / 100;
        target.health.position.x = -0.55 * (1 - life.hp / 100);
      });
    },
    dispose() {
      root.removeFromParent(); box.dispose(); ringGeometry.dispose(); fillGeometry.dispose();
      [hologram, frame, bar, barBack, warning, fill, ...labels].forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
