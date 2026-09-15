import { BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Sprite, SpriteMaterial, type Scene } from 'three';
import { SnapshotBuffer, type RemotePose, type WorldSnapshot } from '@neon-strike/shared/network';

const colors = ['#80e2d0', '#ffac91', '#e9d67e', '#83ccf1', '#b5dfa2', '#eb9fcb', '#e6ece9', '#b8c5fb'];
export function createRemotePlayers(scene: Scene) {
  const root = new Group(); scene.add(root);
  const geometry = new BoxGeometry(1, 1, 1); const armor = new MeshStandardMaterial({ color: '#515c59', roughness: 0.7 });
  const views = colors.map((color) => {
    const group = new Group(); group.visible = false; root.add(group);
    const accent = new MeshBasicMaterial({ color });
    function part(x: number, y: number, z: number, sx: number, sy: number, sz: number, material = armor as MeshStandardMaterial | MeshBasicMaterial) {
      const mesh = new Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh); return mesh;
    }
    part(0, 1.05, 0, 0.5, 0.65, 0.36); part(0, 1.61, 0, 0.34, 0.32, 0.32);
    part(0, 1.64, -0.17, 0.31, 0.1, 0.025, accent); part(0, 1.1, -0.19, 0.29, 0.18, 0.025, accent);
    const legs = [-1, 1].map((side) => part(side * 0.17, 0.36, 0, 0.2, 0.64, 0.25));
    for (const side of [-1, 1]) part(side * 0.32, 1.1, 0, 0.14, 0.48, 0.2);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 64;
    const texture = new CanvasTexture(canvas); const labelMaterial = new SpriteMaterial({ map: texture, depthWrite: false });
    const label = new Sprite(labelMaterial); label.scale.set(3, 0.375, 1); label.position.y = 2.13; group.add(label);
    return { group, accent, legs, canvas, texture, labelMaterial, name: '', id: '', phase: 0 };
  });
  const pose: RemotePose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0 };
  return {
    roster(snapshot: WorldSnapshot, localId: string) {
      for (const view of views) { view.group.visible = false; view.id = ''; }
      for (const player of snapshot.players) {
        if (player.id === localId || !player.connected || snapshot.combat?.fighters.find((p) => p.id === player.id)?.hp === 0) continue;
        const view = views[player.slot]!; view.group.visible = true; view.id = player.id;
        if (view.name !== player.name) {
          view.name = player.name; const context = view.canvas.getContext('2d')!; context.clearRect(0, 0, 512, 64);
          context.font = 'bold 26px monospace'; context.fillStyle = colors[player.slot]!; context.textAlign = 'center'; context.fillText(player.name, 256, 43);
          view.texture.needsUpdate = true;
        }
      }
    },
    update(buffer: SnapshotBuffer, now: number, delta: number) {
      for (const view of views) {
        if (!view.id || !buffer.sample(view.id, now, pose)) continue;
        view.group.position.set(pose.x, pose.y, pose.z); view.group.rotation.y = pose.yaw;
        view.phase = (view.phase + pose.speed * delta * 2) % (Math.PI * 2);
        for (let i = 0; i < view.legs.length; i++) view.legs[i]!.rotation.x = Math.sin(view.phase + i * Math.PI) * Math.min(0.35, pose.speed * 0.07);
      }
    },
    dispose() { root.removeFromParent(); geometry.dispose(); armor.dispose(); for (const view of views) { view.accent.dispose(); view.texture.dispose(); view.labelMaterial.dispose(); } },
  };
}
