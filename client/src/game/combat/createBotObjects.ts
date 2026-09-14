import { BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Sprite, SpriteMaterial, type Scene } from 'three';
import type { BotSession } from '@neon-strike/shared/bots';

const colors = ['#ff897b', '#f5d27a', '#68c9f5', '#a4e68d', '#f395ca', '#dedee4', '#69e2d0'];
export function createBotObjects(scene: Scene, session: BotSession) {
  const root = new Group(); scene.add(root);
  const geometry = new BoxGeometry(1, 1, 1);
  const armor = new MeshStandardMaterial({ color: '#444c4b', roughness: 0.65, metalness: 0.35 });
  const dark = new MeshBasicMaterial({ color: '#14201f' });
  const accents = colors.map((color) => new MeshBasicMaterial({ color }));
  const textures: CanvasTexture[] = []; const labels: SpriteMaterial[] = [];
  const views = session.bots.map((bot, index) => {
    const group = new Group(); root.add(group);
    const color = accents[index]!;
    function part(size: [number, number, number], position: [number, number, number], material: MeshBasicMaterial | MeshStandardMaterial = armor) {
      const mesh = new Mesh(geometry, material); mesh.scale.set(...size); mesh.position.set(...position); group.add(mesh); return mesh;
    }
    part([0.5, 0.65, 0.36], [0, 1.05, 0]);
    part([0.34, 0.32, 0.32], [0, 1.61, 0]);
    part([0.31, 0.1, 0.025], [0, 1.64, -0.17], color);
    part([0.29, 0.18, 0.025], [0, 1.1, -0.19], color);
    const legs = [-1, 1].map((side) => part([0.2, 0.64, 0.25], [side * 0.17, 0.36, 0]));
    for (const side of [-1, 1]) part([0.14, 0.48, 0.2], [side * 0.32, 1.1, -0.1]);
    part([0.18, 0.17, 0.5], [0.3, 1.3, -0.4], dark);
    part([0.12, 0.08, 0.05], [0.3, 1.32, -0.67], color);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 48;
    const context = canvas.getContext('2d')!;
    context.fillStyle = colors[index]!; context.font = 'bold 26px monospace'; context.textAlign = 'center';
    context.fillText(bot.actor.name, 128, 33);
    const texture = new CanvasTexture(canvas); textures.push(texture);
    const material = new SpriteMaterial({ map: texture, depthWrite: false }); labels.push(material);
    const label = new Sprite(material); label.scale.set(1.5, 0.28, 1); label.position.y = 2.13; group.add(label);
    const health = part([0.7, 0.04, 0.04], [0, 1.9, 0], color);
    return { group, health, legs, phase: index };
  });
  return {
    update(delta: number, alpha: number) {
      views.forEach((view, index) => {
        const actor = session.bots[index]!.actor;
        const { state, previous } = actor.controller;
        view.group.visible = actor.life.alive;
        view.group.position.set(previous.x + (state.x - previous.x) * alpha, previous.y + (state.y - previous.y) * alpha, previous.z + (state.z - previous.z) * alpha);
        view.group.rotation.y = actor.yaw;
        const speed = Math.hypot(state.vx, state.vz);
        view.phase = (view.phase + speed * delta * 2) % (Math.PI * 2);
        view.legs.forEach((leg, side) => { leg.rotation.x = Math.sin(view.phase + side * Math.PI) * Math.min(0.35, speed * 0.07); });
        view.health.scale.x = 0.7 * actor.life.hp / 100;
        view.health.position.x = -0.35 * (1 - actor.life.hp / 100);
      });
    },
    dispose() {
      root.removeFromParent(); geometry.dispose(); armor.dispose(); dark.dispose();
      for (const material of [...accents, ...labels]) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
