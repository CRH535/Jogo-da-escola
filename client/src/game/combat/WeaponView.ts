import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry, Vector3, type PerspectiveCamera } from 'three';
import type { WeaponManager } from '@neon-strike/shared/gameplay';

export class WeaponView {
  readonly root = new Group();
  readonly muzzle = new Vector3();
  private box = new BoxGeometry(1, 1, 1);
  private ring = new TorusGeometry(0.07, 0.012, 6, 16);
  private shell = new MeshStandardMaterial({ color: '#c1ccca', roughness: 0.35, metalness: 0.65 });
  private dark = new MeshStandardMaterial({ color: '#22312e', roughness: 0.6, metalness: 0.35 });
  private accents = ['#75f3cd', '#ff9b8d', '#f3db86'].map((color) => new MeshBasicMaterial({ color }));
  private models: Group[] = [];
  private flash = new Mesh(this.box, new MeshBasicMaterial({ color: '#e8fff5', transparent: true, opacity: 0.75 }));
  private recoil = 0;
  private flashTime = 0;
  constructor(private camera: PerspectiveCamera) {
    this.root.scale.setScalar(0.72);
    for (let index = 0; index < 3; index++) {
      const group = new Group(); const accent = this.accents[index]!;
      const block = (size: [number, number, number], position: [number, number, number], material: MeshStandardMaterial | MeshBasicMaterial = this.shell) => {
        const mesh = new Mesh(this.box, material); mesh.scale.set(...size); mesh.position.set(...position); group.add(mesh); return mesh;
      };
      block([0.15 + index * 0.015, 0.15, 0.42], [0, 0, 0]);
      block([0.09, 0.2, 0.12], [0, -0.13, 0.1], this.dark);
      block([0.13, 0.12, 0.26], [0, -0.06, 0.29], this.dark);
      block([0.045, 0.055, 0.36], [0.085, 0.01, -0.01], accent);
      block([index === 1 ? 0.23 : 0.08, 0.08, index === 2 ? 0.48 : 0.2], [0, 0.025, -0.3], this.dark);
      const coil = new Mesh(this.ring, accent); coil.position.set(0, 0.025, -0.37); group.add(coil);
      if (index === 2) { block([0.08, 0.08, 0.15], [0, 0.14, -0.07], this.dark); block([0.045, 0.045, 0.005], [0, 0.14, 0.01], accent); }
      if (index === 1) for (const x of [-0.1, 0.1]) block([0.025, 0.09, 0.21], [x, 0, -0.18], accent);
      this.root.add(group); this.models.push(group);
    }
    this.flash.scale.set(0.055, 0.055, 0.15); this.flash.position.set(0, 0.025, -0.56);
    this.root.add(this.flash); camera.add(this.root);
  }
  shot() { this.recoil = 0.035; this.flashTime = 0.055; }
  update(delta: number, weapons: WeaponManager, alive: boolean) {
    this.recoil = Math.max(0, this.recoil - delta * 0.35); this.flashTime = Math.max(0, this.flashTime - delta);
    this.root.visible = alive;
    const reload = weapons.reloadTicks > 0;
    this.models.forEach((model, index) => { model.visible = index === weapons.selected; });
    this.root.position.set((weapons.aiming ? 0.05 : 0.25) * Math.min(1, this.camera.aspect / 1.2), reload ? -0.37 : -0.22, -0.58 + this.recoil);
    this.root.rotation.set(reload ? -0.35 : this.recoil * 0.6, 0, reload ? -0.25 : 0);
    this.flash.visible = alive && this.flashTime > 0;
    this.root.updateWorldMatrix(true, true); this.flash.getWorldPosition(this.muzzle);
  }
  reset() { this.recoil = 0; this.flashTime = 0; }
  dispose() {
    this.root.removeFromParent(); this.box.dispose(); this.ring.dispose(); this.shell.dispose(); this.dark.dispose();
    this.accents.forEach((material) => material.dispose()); this.flash.material.dispose();
  }
}
