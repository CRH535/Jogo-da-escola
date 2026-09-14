import { BoxGeometry, BufferAttribute, BufferGeometry, DynamicDrawUsage, InstancedMesh, LineBasicMaterial, LineSegments, MeshBasicMaterial, Object3D, type Scene } from 'three';

const CAPACITY = 160;
const TRACERS = 24;
export class ParticleManager {
  private geometry = new BoxGeometry(1, 1, 1);
  private material = new MeshBasicMaterial({ color: '#91ffe0' });
  private mesh = new InstancedMesh(this.geometry, this.material, CAPACITY);
  private dummy = new Object3D();
  private positions = new Float32Array(CAPACITY * 3);
  private velocities = new Float32Array(CAPACITY * 3);
  private lives = new Float32Array(CAPACITY);
  private cursor = 0;
  private lines = new Float32Array(TRACERS * 6);
  private lineLives = new Float32Array(TRACERS);
  private lineGeometry = new BufferGeometry();
  private lineMaterial = new LineBasicMaterial({ color: '#c0ffe9', transparent: true, opacity: 0.6 });
  private lineMesh = new LineSegments(this.lineGeometry, this.lineMaterial);
  private lineCursor = 0;
  constructor(scene: Scene) {
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage); this.mesh.frustumCulled = false;
    this.lineGeometry.setAttribute('position', new BufferAttribute(this.lines, 3).setUsage(DynamicDrawUsage));
    this.lineMesh.frustumCulled = false;
    scene.add(this.mesh, this.lineMesh); this.reset();
  }
  burst(x: number, y: number, z: number, count: number) {
    for (let i = 0; i < Math.min(count, CAPACITY); i++) {
      const slot = this.cursor++ % CAPACITY; const offset = slot * 3;
      this.positions[offset] = x; this.positions[offset + 1] = y; this.positions[offset + 2] = z;
      this.velocities[offset] = (Math.random() - 0.5) * 3;
      this.velocities[offset + 1] = Math.random() * 2;
      this.velocities[offset + 2] = (Math.random() - 0.5) * 3;
      this.lives[slot] = count > 10 ? 0.65 : 0.2;
    }
  }
  trace(from: { x: number; y: number; z: number }, x: number, y: number, z: number) {
    const slot = this.lineCursor++ % TRACERS; const offset = slot * 6;
    this.lines.set([from.x, from.y, from.z, x, y, z], offset); this.lineLives[slot] = 0.065;
  }
  update(delta: number) {
    for (let i = 0; i < CAPACITY; i++) {
      this.lives[i] = Math.max(0, this.lives[i]! - delta);
      const offset = i * 3;
      if (this.lives[i]! > 0) {
        for (let axis = 0; axis < 3; axis++) this.positions[offset + axis] = this.positions[offset + axis]! + this.velocities[offset + axis]! * delta;
        this.velocities[offset + 1] = this.velocities[offset + 1]! - delta * 2;
      }
      this.dummy.position.fromArray(this.positions, offset);
      this.dummy.scale.setScalar(Math.min(0.07, this.lives[i]! * 0.2)); this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < TRACERS; i++) {
      this.lineLives[i] = Math.max(0, this.lineLives[i]! - delta);
      if (this.lineLives[i] === 0) this.lines.fill(0, i * 6, i * 6 + 6);
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.lineGeometry.getAttribute('position').needsUpdate = true;
  }
  reset() { this.lives.fill(0); this.lineLives.fill(0); this.lines.fill(0); this.update(0); }
  dispose() {
    this.mesh.removeFromParent(); this.lineMesh.removeFromParent(); this.mesh.dispose();
    this.geometry.dispose(); this.material.dispose(); this.lineGeometry.dispose(); this.lineMaterial.dispose();
  }
}
