import { NEON_FACILITY } from '@neon-strike/shared/maps';
import { PhysicsRay, type MapWorld } from '@neon-strike/shared/physics';
import { Life, WeaponManager, IDLE_COMBAT, damageAtDistance, type CombatInput } from '@neon-strike/shared/gameplay';
import { Visibility, selectSpawn, type CombatActor } from '@neon-strike/shared/bots';
import { FFA_RULES, MatchManager, type MatchRow, type MatchRules } from '@neon-strike/shared/match';
import type { FeedEntry } from '@neon-strike/shared/hud';
import { MOVEMENT } from '@neon-strike/shared/simulation';
import { COMBAT_EVENT_LIMIT, INTERMISSION_TICKS, type CombatWorld, type NetworkCombatEvent, type PlayerCommand, type WorldSnapshot } from '@neon-strike/shared/network';
import { MovementArena, type Participant } from '../network/MovementArena.js';

interface Fighter extends CombatActor { lifeId: number; eliminations: number; deaths: number; projectiles: number; hits: number }
type EventData<T> = T extends unknown ? Omit<T, 'id' | 'tick'> : never;
const identity = (actor: Fighter) => ({ id: actor.id, name: actor.name, kind: 'player' as const });

export class CombatArena extends MovementArena {
  readonly fighters = new Map<string, Fighter>();
  match: MatchManager | null = null;
  private roundId = 0;
  private intermission = 0;
  private inputs = new Map<string, CombatInput>();
  private events: NetworkCombatEvent[] = [];
  private feed: FeedEntry[] = [];
  private eventId = 0;
  private feedId = 0;
  private visibility: Visibility;
  private ray = new PhysicsRay({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  constructor(physics: MapWorld, private rules: Readonly<MatchRules> = FFA_RULES, private random = Math.random, readonly lobbyControlled = false) {
    super(physics); this.visibility = new Visibility(physics.world);
    this.rules = new MatchManager(rules).rules;
  }
  override join(name: string, token?: string, now = performance.now()) {
    const player = super.join(name, token, now);
    if (typeof player === 'string') return player;
    let fighter = this.fighters.get(player.id);
    if (!fighter) {
      fighter = { id: player.id, name: player.name, bot: false, controller: player.controller, life: new Life(), weapons: new WeaponManager(),
        yaw: player.controller.state.yaw, pitch: player.pitch, lifeId: 1, eliminations: 0, deaths: 0, projectiles: 0, hits: 0 };
      this.fighters.set(player.id, fighter);
      if (this.match?.playing) {
        const actors = [...this.fighters.values()].filter((actor) => this.players.get(actor.id)?.connected);
        player.controller.reset(selectSpawn(NEON_FACILITY, actors, fighter, this.visibility));
      }
    }
    player.controller.collider.setEnabled(fighter.life.alive);
    return player;
  }
  override remove(player: Participant) { this.fighters.delete(player.id); this.inputs.delete(player.id); super.remove(player); }
  startMatch() {
    if (this.match) return false;
    this.resetFighters(); this.match = new MatchManager(this.rules); this.roundId++; this.intermission = 0;
    console.info(`[GAME] Online match ${this.roundId} started`); return true;
  }
  returnToLobby() {
    this.match = null; this.intermission = 0; this.resetFighters();
    for (const player of this.players.values()) this.setActive(player, false);
  }
  protected override beforeTick() {
    this.inputs.clear();
    while (this.events[0] && this.events[0].tick < this.tick - 120) this.events.shift();
    while (this.feed[0] && this.feed[0].expiresAtTick <= this.tick) this.feed.shift();
    if (!this.players.size) { this.match = null; this.intermission = 0; this.feed.length = 0; this.events.length = 0; return; }
    if (this.lobbyControlled) return;
    const connected = [...this.players.values()].filter((p) => p.connected).length;
    if (this.match?.ended && ++this.intermission >= INTERMISSION_TICKS) { this.match = null; if (connected < 2) this.resetFighters(); }
    if (!this.match && connected >= 2) {
      this.startMatch();
    }
  }
  protected override canMove(player: Participant, command?: PlayerCommand) {
    const fighter = this.fighters.get(player.id)!;
    return fighter.life.alive && (this.match ? this.match.playing : !this.lobbyControlled) && (!command?.combat || command.combat.lifeId === fighter.lifeId);
  }
  protected override commandReceived(player: Participant, command?: PlayerCommand) {
    const fighter = this.fighters.get(player.id)!;
    if (!this.match?.playing || !fighter.life.alive || !command?.combat || command.combat.lifeId !== fighter.lifeId) return;
    this.inputs.set(player.id, command.combat);
  }
  protected override afterTick() {
    if (!this.match?.playing) { this.match?.advanceCountdown(); return; }
    const respawned = new Set<string>();
    for (const [id, fighter] of this.fighters) {
      const player = this.players.get(id)!;
      if (player.connected && !fighter.life.alive && fighter.life.step()) {
        const actors = [...this.fighters.values()].filter((actor) => this.players.get(actor.id)?.connected);
        const spawn = selectSpawn(NEON_FACILITY, actors, fighter, this.visibility);
        fighter.controller.reset(spawn); fighter.weapons.reset(); fighter.lifeId++;
        fighter.controller.collider.setEnabled(true); player.pitch = 0; this.clearCommands(player);
        respawned.add(id);
      }
    }
    this.physics.world.updateSceneQueries();
    for (const [id, fighter] of this.fighters) {
      const player = this.players.get(id)!;
      if (!player.connected || !fighter.life.alive || respawned.has(id) || this.limitReached) continue;
      const event = fighter.weapons.step(player.active ? this.inputs.get(id) ?? IDLE_COMBAT : IDLE_COMBAT, true);
      if (event === 'shot') this.shoot(fighter, player.pitch);
      else if (event) this.emit({ type: event, actorId: id, weapon: fighter.weapons.selected });
    }
    this.match.afterTick(this.leadingEliminations, this.rows);
    if (this.match.ended) {
      for (const player of this.players.values()) this.clearCommands(player);
      console.info(`[GAME] Online match ${this.roundId} ended`);
    }
  }
  private get leadingEliminations() { let leading = 0; for (const p of this.fighters.values()) leading = Math.max(leading, p.eliminations); return leading; }
  private get limitReached() { return this.leadingEliminations >= this.rules.eliminationLimit; }
  private clearCommands(player: Participant) {
    player.commands.length = 0; player.ack = player.accepted; player.controller.clearInput();
    player.controller.body.setNextKinematicTranslation(player.controller.body.translation());
  }
  private damage(victim: Fighter, attacker: Fighter, amount: number) {
    if (!this.match?.playing || this.limitReached || attacker === victim || !attacker.life.alive || !this.players.get(victim.id)?.connected || !victim.life.damage(amount)) return false;
    if (!victim.life.alive) {
      victim.deaths++; attacker.eliminations++; victim.weapons.cancel(); victim.controller.collider.setEnabled(false);
      this.clearCommands(this.players.get(victim.id)!); this.physics.world.updateSceneQueries();
      this.feed.push({ id: ++this.feedId, attacker: identity(attacker), victim: identity(victim), equipment: attacker.weapons.weapon.name, expiresAtTick: this.tick + 300 });
      if (this.feed.length > 4) this.feed.shift();
      const { x, y, z } = victim.controller.state;
      this.emit({ type: 'elimination', actorId: attacker.id, victimId: victim.id, position: { x, y: y + 0.9, z } });
    }
    return true;
  }
  private shoot(actor: Fighter, pitch: number) {
    const { state } = actor.controller; const { weapon } = actor.weapons;
    Object.assign(this.ray.origin, { x: state.x, y: state.y + MOVEMENT.eyeHeight, z: state.z });
    const impacts = [];
    for (let pellet = 0; pellet < weapon.pellets && !this.limitReached; pellet++) {
      actor.projectiles++;
      const angle = this.random() * Math.PI * 2; const radius = Math.sqrt(this.random()) * weapon.spread * (actor.weapons.aiming ? 0.35 : 1);
      const yaw = state.yaw + Math.cos(angle) * radius; const elevation = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + Math.sin(angle) * radius));
      Object.assign(this.ray.dir, { x: -Math.sin(yaw) * Math.cos(elevation), y: Math.sin(elevation), z: -Math.cos(yaw) * Math.cos(elevation) });
      const hit = this.physics.world.castRay(this.ray, weapon.range, true, undefined, undefined, actor.controller.collider);
      const distance = hit?.toi ?? weapon.range;
      const target = hit && [...this.fighters.values()].find((p) => p.controller.collider.handle === hit.collider.handle);
      const damaged = Boolean(target && this.damage(target, actor, damageAtDistance(weapon, distance)));
      if (damaged) actor.hits++;
      impacts.push({ ...this.ray.pointAt(distance), hit: damaged });
    }
    this.emit({ type: 'shot', actorId: actor.id, weapon: actor.weapons.selected, from: { ...this.ray.origin }, impacts });
  }
  private emit(event: EventData<NetworkCombatEvent>) {
    this.events.push({ ...event, id: ++this.eventId, tick: this.tick });
    if (this.events.length > COMBAT_EVENT_LIMIT) this.events.shift();
  }
  private rows = (): MatchRow[] => [...this.fighters.values()].map((p) => ({ id: p.id, name: p.name, eliminations: p.eliminations,
    deaths: p.deaths, score: p.eliminations * 100, projectiles: p.projectiles, hits: p.hits, pingMs: this.players.get(p.id)?.pingMs ?? null, local: false }));
  private resetFighters() {
    this.feed.length = 0; this.events.length = 0;
    for (const [id, fighter] of this.fighters) {
      const player = this.players.get(id)!;
      fighter.life.reset(); fighter.weapons.reset(); fighter.lifeId++; fighter.eliminations = 0; fighter.deaths = 0; fighter.projectiles = 0; fighter.hits = 0;
      fighter.controller.reset(NEON_FACILITY.spawns[player.slot]!); fighter.controller.collider.setEnabled(player.connected); player.pitch = 0; this.clearCommands(player);
    }
    // Settle fresh capsules before freezing the countdown, without consuming match time.
    for (let step = 0; step < 2; step++) {
      for (const player of this.players.values()) if (player.connected) player.controller.beforeStep({ forward: 0, right: 0, yaw: player.controller.state.yaw, jump: false, sprint: false });
      this.physics.world.step();
      for (const player of this.players.values()) if (player.connected) player.controller.afterStep();
    }
  }
  override snapshot(): WorldSnapshot {
    const combat: CombatWorld = { fighters: [...this.fighters.values()].map((p) => ({ id: p.id, lifeId: p.lifeId, hp: p.life.hp, respawnTicks: p.life.respawnTicks,
      selected: p.weapons.selected, magazine: p.weapons.current.magazine, reserve: p.weapons.current.reserve, reloadTicks: p.weapons.reloadTicks, aiming: p.weapons.aiming,
      eliminations: p.eliminations, deaths: p.deaths, projectiles: p.projectiles, hits: p.hits })),
      match: { ...(this.match?.snapshot() ?? { state: 'WAITING', countdown: 0, go: false, remainingSeconds: Math.ceil(this.rules.durationTicks / 60), eliminationLimit: this.rules.eliminationLimit, result: null }),
        roundId: this.roundId, nextRoundSeconds: this.match?.ended ? Math.ceil((INTERMISSION_TICKS - this.intermission) / 60) : 0 },
      feed: this.feed.slice(), events: this.events.slice() };
    return { ...super.snapshot(), combat };
  }
  override dispose() { super.dispose(); this.events.length = 0; this.feed.length = 0; this.inputs.clear(); }
}
