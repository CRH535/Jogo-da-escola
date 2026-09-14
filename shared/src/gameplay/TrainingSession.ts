import RAPIER from '@dimforge/rapier3d-compat';
import { MOVEMENT, type PlayerController } from '../simulation/player/movement.js';
import { Life } from './Life.js';
import { ENERGY_FIELD, TARGET_HALF_SIZE, TRAINING_TARGETS } from './trainingLayout.js';
import { WeaponManager, damageAtDistance, type CombatInput } from './weapons.js';
import { TrainingStats } from './TrainingStats.js';

export type CombatEvent =
  | { type: 'shot' | 'reload' | 'loaded' | 'damage' | 'death' | 'respawn' }
  | { type: 'impact'; x: number; y: number; z: number; hit: boolean }
  | { type: 'elimination'; x: number; y: number; z: number };
export interface CombatSnapshot {
  hp: number; respawn: number; selected: number; name: string; magazine: number; reserve: number;
  reload: number; reloadProgress: number; capacity: number; aiming: boolean; hits: number; eliminations: number;
}

export class TrainingSession {
  readonly life = new Life();
  readonly weapons = new WeaponManager();
  readonly stats = new TrainingStats();
  readonly targets;
  readonly events: CombatEvent[] = [];
  hits = 0;
  get eliminations() { return this.stats.eliminations; }
  private exposure = 0;
  private disposed = false;
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  constructor(private world: RAPIER.World, private player: PlayerController, private random = Math.random) {
    this.targets = TRAINING_TARGETS.map((target) => ({ ...target, life: new Life(), collider: world.createCollider(
      RAPIER.ColliderDesc.cuboid(...TARGET_HALF_SIZE).setTranslation(...target.position).setSensor(true),
    ) }));
    world.updateSceneQueries();
  }
  snapshot(): CombatSnapshot {
    const { weapons, life } = this;
    return { hp: life.hp, respawn: Math.ceil(life.respawnTicks / 60), selected: weapons.selected, name: weapons.weapon.name,
      magazine: weapons.current.magazine, reserve: weapons.current.reserve, reload: weapons.reloadTicks / 60,
      capacity: weapons.weapon.magazine, reloadProgress: weapons.reloadTicks ? 1 - weapons.reloadTicks / weapons.weapon.reload : 0,
      aiming: weapons.aiming, hits: this.hits, eliminations: this.eliminations };
  }
  step(input: CombatInput, yaw: number, pitch: number) {
    this.events.length = 0;
    this.stats.step();
    let queriesChanged = false;
    for (const target of this.targets) {
      if (target.life.step()) { target.collider.setEnabled(true); queriesChanged = true; }
    }
    if (queriesChanged) this.world.updateSceneQueries();
    if (this.life.step()) {
      this.weapons.reset(); this.player.reset(); this.exposure = 0;
      this.events.push({ type: 'respawn' });
      return;
    }
    const { x, y, z } = this.player.state;
    const field = ENERGY_FIELD;
    if (this.life.alive && y < field.height && Math.hypot(x - field.x, z - field.z) < field.radius) {
      if (++this.exposure >= field.interval) { this.exposure = 0; this.damagePlayer(field.damage); }
    } else this.exposure = 0;
    const event = this.weapons.step(input, this.life.alive);
    if (event) this.events.push({ type: event });
    if (event === 'shot' && Number.isFinite(yaw) && Number.isFinite(pitch)) this.shoot(yaw, pitch);
  }
  damagePlayer(amount: number) {
    if (!this.life.damage(amount)) return;
    this.events.push({ type: 'damage' });
    if (!this.life.alive) {
      this.weapons.cancel(); this.player.clearInput();
      this.stats.playerEliminated();
      this.events.push({ type: 'death' });
    }
  }
  private shoot(yaw: number, pitch: number) {
    const { weapon } = this.weapons;
    const { state } = this.player;
    Object.assign(this.ray.origin, { x: state.x, y: state.y + MOVEMENT.eyeHeight, z: state.z });
    for (let pellet = 0; pellet < weapon.pellets; pellet++) {
      const angle = this.random() * Math.PI * 2;
      const radius = Math.sqrt(this.random()) * weapon.spread * (this.weapons.aiming ? 0.35 : 1);
      const shotYaw = yaw + Math.cos(angle) * radius;
      const shotPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + Math.sin(angle) * radius));
      const cosPitch = Math.cos(shotPitch);
      Object.assign(this.ray.dir, { x: -Math.sin(shotYaw) * cosPitch, y: Math.sin(shotPitch), z: -Math.cos(shotYaw) * cosPitch });
      // The first Rapier hit wins: solids occlude targets. Ignore only our own capsule.
      const hit = this.world.castRay(this.ray, weapon.range, true, undefined, undefined, this.player.collider);
      const distance = hit?.toi ?? weapon.range;
      const target = hit && this.targets.find((item) => item.collider.handle === hit.collider.handle);
      const damaged = Boolean(target && target.life.damage(damageAtDistance(weapon, distance)));
      const point = this.ray.pointAt(distance);
      this.events.push({ type: 'impact', ...point, hit: damaged });
      if (damaged && target) {
        this.hits++;
        if (!target.life.alive) {
          this.stats.targetEliminated(target.id, weapon.name);
          target.collider.setEnabled(false);
          this.world.updateSceneQueries();
          const [x, y, z] = target.position;
          this.events.push({ type: 'elimination', x, y, z });
        }
      }
    }
  }
  reset() {
    this.life.reset(); this.weapons.reset(); this.events.length = 0;
    this.exposure = 0; this.hits = 0; this.stats.reset();
    for (const target of this.targets) { target.life.reset(); target.collider.setEnabled(true); }
    this.world.updateSceneQueries();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const target of this.targets) this.world.removeCollider(target.collider, false);
    this.events.length = 0;
  }
}
