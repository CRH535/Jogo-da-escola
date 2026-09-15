import { randomBytes, randomUUID } from 'node:crypto';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import type { MapWorld } from '@neon-strike/shared/physics';
import { createPlayerController, type PlayerController } from '@neon-strike/shared/simulation';
import { NET, type InputPacket, type NetworkPlayer, type PlayerCommand, type WorldSnapshot } from '@neon-strike/shared/network';

export interface Participant {
  id: string; token: string; epoch: string; name: string; slot: number; connected: boolean; active: boolean;
  controller: PlayerController; commands: PlayerCommand[]; accepted: number; ack: number; pitch: number;
  pingMs: number | null; expires: number;
}
export class MovementArena {
  readonly players = new Map<string, Participant>();
  tick = 0;
  private neutral = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
  constructor(readonly physics: MapWorld) {}
  join(name: string, token?: string, now = performance.now()): Participant | 'EXPIRED' | 'IN_USE' | 'FULL' {
    let player = token ? [...this.players.values()].find((candidate) => candidate.token === token) : undefined;
    if (player && !player.connected && now >= player.expires) { this.remove(player); return 'EXPIRED'; }
    if (token && !player) return 'EXPIRED';
    if (player?.connected) return 'IN_USE';
    if (!player) {
      const slot = NEON_FACILITY.spawns.findIndex((_, index) => ![...this.players.values()].some((p) => p.slot === index));
      if (slot < 0) return 'FULL';
      player = { id: randomUUID(), token: randomBytes(32).toString('base64url'), epoch: randomUUID(), name, slot, connected: true, active: false,
        controller: createPlayerController(this.physics.world, NEON_FACILITY, NEON_FACILITY.spawns[slot]!, false), commands: [], accepted: 0, ack: 0, pitch: 0, pingMs: null, expires: 0 };
      this.players.set(player.id, player);
    } else {
      player.epoch = randomUUID(); player.connected = true; player.active = false; player.commands.length = 0;
      player.accepted = 0; player.ack = 0; player.expires = 0; player.pingMs = null;
      player.controller.clearInput(); player.controller.collider.setEnabled(true);
    }
    return player;
  }
  input(player: Participant, packet: InputPacket) {
    if (!player.connected || packet.epoch !== player.epoch) return false;
    let seq = player.accepted;
    for (const command of packet.commands) { if (command.seq !== seq + 1) return false; seq = command.seq; }
    if (player.commands.length + packet.commands.length > NET.queueLimit) return false;
    player.accepted = seq;
    if (player.active) player.commands.push(...packet.commands);
    else player.ack = seq;
    return true;
  }
  setActive(player: Participant, active: boolean) {
    player.active = active; player.commands.length = 0; player.ack = player.accepted; player.controller.clearInput();
  }
  disconnect(player: Participant, now: number, voluntary: boolean) {
    if (voluntary) { this.remove(player); return; }
    this.setActive(player, false); player.connected = false; player.expires = now + NET.recoveryMs;
    player.controller.collider.setEnabled(false);
    player.controller.body.setNextKinematicTranslation(player.controller.body.translation());
  }
  remove(player: Participant) { if (this.players.delete(player.id)) player.controller.dispose(); }
  protected beforeTick() {}
  protected afterTick() {}
  protected canMove(_player: Participant, _command?: PlayerCommand) { return true; }
  protected commandReceived(_player: Participant, _command?: PlayerCommand) {}
  step(now: number) {
    this.beforeTick();
    for (const player of this.players.values()) {
      if (!player.connected) { if (now >= player.expires) this.remove(player); continue; }
      const command = player.active ? player.commands.shift() : undefined;
      if (command) { player.ack = command.seq; player.pitch = command.pitch; }
      this.commandReceived(player, command);
      if (!this.canMove(player, command)) {
        player.controller.clearInput(); player.controller.body.setNextKinematicTranslation(player.controller.body.translation());
        continue;
      }
      this.neutral.yaw = player.controller.state.yaw;
      this.neutral.jump = player.active && player.controller.jumpHeld;
      player.controller.beforeStep(command ?? this.neutral);
    }
    this.physics.world.step();
    for (const player of this.players.values()) if (player.connected) player.controller.afterStep();
    this.tick++;
    this.afterTick();
  }
  snapshot(): WorldSnapshot {
    const players: NetworkPlayer[] = [...this.players.values()].map((p) => ({ id: p.id, name: p.name, slot: p.slot, connected: p.connected,
      active: p.active, pingMs: p.pingMs, ack: p.ack, pitch: p.pitch, pose: p.controller.checkpoint() }));
    return { tick: this.tick, players };
  }
  dispose() { for (const player of this.players.values()) this.remove(player); this.physics.dispose(); }
}
