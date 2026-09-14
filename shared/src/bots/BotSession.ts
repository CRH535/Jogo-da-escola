import RAPIER from '@dimforge/rapier3d-compat';
import { NEON_FACILITY } from '../maps/neonFacility.js';
import type { MapWorld } from '../physics/createMapWorld.js';
import { createPlayerController, MOVEMENT, type PlayerController } from '../simulation/player/movement.js';
import { Life } from '../gameplay/Life.js';
import { WeaponManager, damageAtDistance, type CombatInput } from '../gameplay/weapons.js';
import { TrainingStats } from '../gameplay/TrainingStats.js';
import type { CombatEvent, CombatSnapshot } from '../gameplay/TrainingSession.js';
import { BotBrain } from './BotBrain.js';
import { NavigationGraph } from './NavigationGraph.js';
import { Visibility } from './Visibility.js';
import { selectSpawn } from './SpawnManager.js';
import { normalizeBotOptions, type BotOptions, type CombatActor } from './types.js';
import { MatchManager, type MatchRules, type MatchRow } from '../match/MatchManager.js';

export type BotCombatEvent = CombatEvent | { type: 'bot-impact'; x: number; y: number; z: number; from: { x: number; y: number; z: number } };
const identity = (actor: CombatActor) => ({ id: actor.id, name: actor.name, kind: actor.bot ? 'bot' as const : 'player' as const });
export class BotSession {
  readonly life = new Life();
  readonly weapons = new WeaponManager();
  readonly stats: TrainingStats;
  readonly actors: CombatActor[];
  readonly bots: BotBrain[];
  readonly navigation: NavigationGraph;
  readonly visibility: Visibility;
  readonly events: BotCombatEvent[] = [];
  readonly options: BotOptions;
  hits = 0;
  readonly match: MatchManager | null;
  private accuracy = new Map<string, { projectiles: number; hits: number }>();
  private disposed = false;
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
  constructor(private physics: MapWorld, private player: PlayerController, options: BotOptions, private random = Math.random, rules?: Readonly<MatchRules>) {
    this.match = rules ? new MatchManager(rules) : null;
    this.options = normalizeBotOptions(options);
    this.navigation = new NavigationGraph(physics, NEON_FACILITY);
    this.visibility = new Visibility(physics.world);
    this.actors = [{ id: 'local-player', name: 'Player', bot: false, controller: player, life: this.life, weapons: this.weapons, yaw: 0, pitch: 0 }];
    this.bots = Array.from({ length: this.options.count }, (_, index) => {
      const spawn = NEON_FACILITY.spawns[index]!;
      const actor: CombatActor = { id: `bot-${index + 1}`, name: `BOT-${String(index + 1).padStart(2, '0')}`, bot: true,
        controller: createPlayerController(physics.world, NEON_FACILITY, spawn), life: new Life(), weapons: new WeaponManager(), yaw: spawn.yaw, pitch: 0 };
      this.actors.push(actor);
      return new BotBrain(actor, this.options.difficulty, this.navigation, this.visibility, random, index);
    });
    this.stats = new TrainingStats('Player', this.actors.slice(1).map(identity));
    for (const actor of this.actors) this.accuracy.set(actor.id, { projectiles: 0, hits: 0 });
  }
  get playing() { return this.match?.playing ?? true; }
  private get limitReached() { return Boolean(this.match && this.stats.leadingEliminations >= this.match.rules.eliminationLimit); }
  matchRows = (): MatchRow[] => this.stats.snapshot().players.map((row) => ({ ...row, ...this.accuracy.get(row.id)! }));
  get eliminations() { return this.stats.eliminations; }
  snapshot(): CombatSnapshot {
    const { weapons } = this;
    return { hp: this.life.hp, respawn: Math.ceil(this.life.respawnTicks / 60), selected: weapons.selected, name: weapons.weapon.name,
      magazine: weapons.current.magazine, reserve: weapons.current.reserve, reload: weapons.reloadTicks / 60,
      reloadProgress: weapons.reloadTicks ? 1 - weapons.reloadTicks / weapons.weapon.reload : 0, capacity: weapons.weapon.magazine,
      aiming: weapons.aiming, hits: this.hits, eliminations: this.eliminations };
  }
  beforePhysics() {
    if (!this.playing) return;
    for (const bot of this.bots) {
      bot.step(this.actors);
      if (bot.actor.life.alive) bot.actor.controller.beforeStep(bot.movement);
    }
  }
  afterPhysics() { if (this.playing) for (const bot of this.bots) if (bot.actor.life.alive) bot.actor.controller.afterStep(); }
  step(input: CombatInput, yaw: number, pitch: number) {
    this.events.length = 0;
    if (!this.playing) { this.match?.advanceCountdown(); return; }
    this.stats.step();
    const local = this.actors[0]!; local.yaw = yaw; local.pitch = pitch;
    for (const actor of this.actors) {
      if (!actor.life.alive) {
        if (actor.life.step()) {
          const spawn = selectSpawn(NEON_FACILITY, this.actors, actor, this.visibility);
          actor.controller.reset(spawn); actor.controller.collider.setEnabled(true); actor.weapons.reset();
          actor.yaw = spawn.yaw; actor.pitch = 0;
          this.physics.world.updateSceneQueries();
          if (actor.bot) this.bots.find((bot) => bot.actor === actor)!.reset();
          else this.events.push({ type: 'respawn' });
        }
      }
    }
    for (const actor of this.actors) {
      if (this.limitReached) break;
      if (!actor.life.alive || this.events.some((event) => event.type === 'respawn') && !actor.bot) continue;
      const combat = actor.bot ? this.bots.find((bot) => bot.actor === actor)!.combat : input;
      const event = actor.weapons.step(combat, true);
      if (event && !actor.bot) this.events.push({ type: event });
      if (event === 'shot' && Number.isFinite(actor.yaw) && Number.isFinite(actor.pitch)) this.shoot(actor);
    }
    this.match?.afterTick(this.stats.leadingEliminations, this.matchRows);
  }
  damage(victim: CombatActor, attacker: CombatActor, amount: number) {
    if (!this.playing || this.limitReached) return false;
    if (attacker === victim || !attacker.life.alive || !victim.life.damage(amount)) return false;
    if (!victim.bot) this.events.push({ type: 'damage' });
    if (!victim.life.alive) {
      victim.weapons.cancel(); victim.controller.clearInput(); victim.controller.collider.setEnabled(false);
      this.physics.world.updateSceneQueries();
      this.stats.actorEliminated(identity(attacker), identity(victim), attacker.weapons.weapon.name);
      const { x, y, z } = victim.controller.state;
      this.events.push({ type: 'elimination', x, y: y + 0.9, z });
      if (victim.bot) this.bots.find((bot) => bot.actor === victim)!.state = 'RESPAWN';
      else this.events.push({ type: 'death' });
    }
    return true;
  }
  private shoot(actor: CombatActor) {
    const { state } = actor.controller; const { weapon } = actor.weapons;
    Object.assign(this.ray.origin, { x: state.x, y: state.y + MOVEMENT.eyeHeight, z: state.z });
    for (let pellet = 0; pellet < weapon.pellets; pellet++) {
      if (this.limitReached) break;
      const accuracy = this.accuracy.get(actor.id)!;
      accuracy.projectiles++;
      const angle = this.random() * Math.PI * 2;
      const radius = Math.sqrt(this.random()) * weapon.spread * (actor.weapons.aiming ? 0.35 : 1);
      const yaw = actor.yaw + Math.cos(angle) * radius;
      const pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, actor.pitch + Math.sin(angle) * radius));
      Object.assign(this.ray.dir, { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });
      const hit = this.physics.world.castRay(this.ray, weapon.range, true, undefined, undefined, actor.controller.collider);
      const length = hit?.toi ?? weapon.range;
      const target = hit && this.actors.find((candidate) => candidate.controller.collider.handle === hit.collider.handle);
      const damaged = Boolean(target && this.damage(target, actor, damageAtDistance(weapon, length)));
      if (damaged) accuracy.hits++;
      const point = this.ray.pointAt(length);
      if (actor.bot) this.events.push({ type: 'bot-impact', ...point, from: { ...this.ray.origin } });
      else { this.events.push({ type: 'impact', ...point, hit: damaged }); if (damaged) this.hits++; }
    }
  }
  reset() {
    this.events.length = 0; this.hits = 0; this.stats.reset();
    this.match?.reset();
    for (const accuracy of this.accuracy.values()) { accuracy.projectiles = 0; accuracy.hits = 0; }
    for (let index = 0; index < this.actors.length; index++) {
      const actor = this.actors[index]!; const spawn = NEON_FACILITY.spawns[index === 0 ? 7 : index - 1]!;
      actor.life.reset(); actor.weapons.reset(); actor.controller.reset(spawn); actor.controller.collider.setEnabled(true);
      actor.yaw = spawn.yaw; actor.pitch = 0;
    }
    for (const bot of this.bots) bot.reset();
    this.physics.world.updateSceneQueries();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const bot of this.bots) bot.actor.controller.dispose();
    this.player.collider.setEnabled(true); this.navigation.dispose(); this.events.length = 0;
  }
}
