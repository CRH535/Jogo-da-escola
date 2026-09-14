import { IDLE_COMBAT, type CombatInput } from '../gameplay/weapons.js';
import type { MovementInput, PlayerPose } from '../simulation/player/movement.js';
import { NavigationGraph, distance, type Waypoint } from './NavigationGraph.js';
import { BOT_PROFILES, type BotDifficulty, type BotState, type CombatActor } from './types.js';
import type { Visibility } from './Visibility.js';

const patrolPoints = [[0, 0, 0], [-11, 0, -15], [0, 3, -16], [11, 0, 15], [20, 0, 0], [0, 3, 16], [-20, 0, 0]] as const;
const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export class BotBrain {
  state: BotState = 'PATROL';
  targetId: string | null = null;
  readonly movement: MovementInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
  readonly combat: CombatInput = { ...IDLE_COMBAT };
  private profile;
  private tick = 0;
  private lastSeen: PlayerPose | null = null;
  private lostTicks = 0;
  private visible = false;
  private reaction = 0;
  private errorYaw = 0;
  private errorPitch = 0;
  private goal: PlayerPose | null = null;
  private route: Waypoint[] = [];
  private cursor = 0;
  private patrolIndex = 0;
  private progress: PlayerPose = { x: 0, y: 0, z: 0 };
  private escapeTicks = 0;
  replans = 0;
  constructor(readonly actor: CombatActor, difficulty: BotDifficulty, private navigation: NavigationGraph,
    private visibility: Visibility, private random: () => number, private index: number) {
    this.profile = BOT_PROFILES[difficulty];
    this.reset();
  }
  reset() {
    this.state = 'PATROL'; this.targetId = null; this.lastSeen = null; this.goal = null;
    this.route = []; this.cursor = 0; this.tick = this.index * 3; this.lostTicks = 0;
    this.visible = false; this.reaction = 0; this.escapeTicks = 0; this.replans = 0;
    Object.assign(this.progress, this.actor.controller.state);
    this.patrolIndex = 0; Object.assign(this.combat, IDLE_COMBAT);
    Object.assign(this.movement, { forward: 0, right: 0, yaw: this.actor.yaw });
  }
  private decide(actors: readonly CombatActor[]) {
    const { actor, profile } = this;
    const previousState = this.state;
    let target = actors.find((candidate) => candidate.id === this.targetId && this.visibility.detects(actor, candidate, profile.range));
    if (!target) {
      let closest = Infinity;
      for (const candidate of actors) {
        if (!this.visibility.detects(actor, candidate, profile.range)) continue;
        const length = distance(actor.controller.state, candidate.controller.state);
        if (length < closest) { closest = length; target = candidate; }
      }
    }
    this.visible = Boolean(target);
    if (target) {
      if (target.id !== this.targetId) this.reaction = 0;
      this.targetId = target.id; this.lostTicks = 0;
      const position = target.controller.state;
      this.lastSeen = { x: position.x, y: position.y, z: position.z };
      this.state = distance(actor.controller.state, position) <= 19 ? 'ATTACK' : 'CHASE';
    } else {
      this.reaction = 0;
      if (this.lastSeen && this.lostTicks < 180) this.state = 'SEARCH';
      else { this.state = 'PATROL'; this.targetId = null; this.lastSeen = null; }
    }
    if (this.state !== previousState) { this.goal = null; this.route = []; }
  }
  private chooseGoal() {
    const position = this.actor.controller.state;
    if (this.state === 'CHASE' || this.state === 'SEARCH') this.goal = this.lastSeen;
    else if (this.state === 'ATTACK') {
      if (!this.profile.strafe) { this.goal = null; return; }
      if (!this.goal || distance(position, this.goal) < 0.5 || this.tick % 90 === 0) {
        const side = this.random() < 0.5 ? -1 : 1;
        this.goal = this.navigation.nearest({ x: position.x + Math.cos(this.actor.yaw) * side * 3,
          y: position.y, z: position.z - Math.sin(this.actor.yaw) * side * 3 });
      }
    } else if (!this.goal || distance(position, this.goal) < 0.6) {
      const point = patrolPoints[this.patrolIndex++ % patrolPoints.length]!;
      this.goal = { x: point[0], y: point[1], z: point[2] };
      if (this.patrolIndex === 1) this.patrolIndex += this.index;
    }
  }
  step(actors: readonly CombatActor[]) {
    const { actor, profile } = this;
    Object.assign(this.combat, IDLE_COMBAT);
    this.movement.forward = 0; this.movement.right = 0;
    if (!actor.life.alive) { this.state = 'RESPAWN'; this.targetId = null; actor.controller.clearInput(); return; }
    this.tick++; this.lostTicks++;
    if (this.tick % 6 === 0 || this.tick === 1) this.decide(actors);
    if (this.visible) this.reaction++;
    const position = actor.controller.state;
    if (this.tick % 30 === 0 || !this.goal) {
      const oldGoal = this.goal && this.navigation.nearest(this.goal).id;
      this.chooseGoal();
      if (this.goal && (oldGoal !== this.navigation.nearest(this.goal).id || !this.route.length)) {
        // Finish the current segment before following a changed route; never oscillate back to its start.
        const start = this.route[this.cursor] ?? position;
        this.route = this.navigation.path(start, this.goal, actors.filter((a) => a !== actor && a.life.alive).map((a) => a.controller.state));
        this.cursor = 0; this.replans++;
      } else if (!this.goal) this.route = [];
    }
    while (this.cursor < this.route.length && distance(position, this.route[this.cursor]!) < 0.23) this.cursor++;
    const next = this.route[this.cursor];
    let dx = next ? next.x - position.x : 0; let dz = next ? next.z - position.z : 0;
    const length = Math.hypot(dx, dz);
    if (length > 0.05) { dx /= length; dz /= length; }
    if (this.tick % 60 === 0) {
      if (length > 0.3 && distance(position, this.progress) < 0.4) { this.escapeTicks = 25; this.goal = null; this.route = []; }
      Object.assign(this.progress, position);
    }
    if (this.escapeTicks > 0) {
      this.escapeTicks--;
      const side = this.index % 2 ? -1 : 1;
      const oldX = dx; dx = -dx * 0.5 + dz * side; dz = -dz * 0.5 - oldX * side;
    }
    const look = this.lastSeen;
    let desiredYaw = length > 0.05 ? Math.atan2(-dx, -dz) : actor.yaw;
    let desiredPitch = 0;
    if (look) {
      const horizontal = Math.hypot(look.x - position.x, look.z - position.z);
      if (this.tick % 18 === 0) {
        this.errorYaw = (this.random() * 2 - 1) * profile.spread;
        this.errorPitch = (this.random() * 2 - 1) * profile.spread;
      }
      desiredYaw = Math.atan2(position.x - look.x, position.z - look.z) + this.errorYaw;
      desiredPitch = Math.atan2(look.y - position.y - 0.35, horizontal) + this.errorPitch;
    }
    const turn = profile.turn / 60;
    actor.yaw += Math.max(-turn, Math.min(turn, angleDifference(desiredYaw, actor.yaw)));
    actor.yaw = Math.atan2(Math.sin(actor.yaw), Math.cos(actor.yaw));
    actor.pitch += Math.max(-turn, Math.min(turn, desiredPitch - actor.pitch));
    this.movement.yaw = actor.yaw;
    const speed = profile.speed * Math.min(1, length / 0.5);
    this.movement.forward = (-dx * Math.sin(actor.yaw) - dz * Math.cos(actor.yaw)) * speed;
    this.movement.right = (dx * Math.cos(actor.yaw) - dz * Math.sin(actor.yaw)) * speed;
    const ready = this.visible && this.reaction >= profile.reaction && Math.abs(angleDifference(desiredYaw, actor.yaw)) < 0.18;
    this.combat.fire = ready && this.tick % profile.shotInterval === 0;
    this.combat.pressed = this.combat.fire;
    this.combat.reload = actor.weapons.current.magazine === 0 && actor.weapons.reloadTicks === 0;
    if (actor.weapons.current.magazine === 0 && actor.weapons.current.reserve === 0) {
      this.combat.select = actor.weapons.ammo.findIndex((ammo) => ammo.magazine + ammo.reserve > 0);
    }
  }
}
