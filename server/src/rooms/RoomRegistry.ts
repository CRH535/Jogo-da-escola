import { randomBytes } from 'node:crypto';
import { createMapWorld } from '@neon-strike/shared/physics';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import { INTERMISSION_TICKS, ROOM_LIMIT, type LobbyError, type LobbySnapshot, type RoomSettings, type WorldSnapshot } from '@neon-strike/shared/network';
import type { MatchRules } from '@neon-strike/shared/match';
import { CombatArena } from '../game/CombatArena.js';
import type { Participant } from '../network/MovementArena.js';

export class Room {
  hostId = '';
  closed = false;
  private ready = new Set<string>();
  private endTicks = 0;
  constructor(readonly id: string, readonly settings: Readonly<RoomSettings>, readonly arena: CombatArena,
    private addresses: () => string[], private closeRoom: (id: string) => void) {}
  enter(name: string, token?: string) {
    if (this.closed) return 'ROOM_CLOSED' as const;
    if (!token) {
      if (this.arena.match) return 'STARTED' as const;
      if (this.arena.players.size >= this.settings.maxPlayers) return 'FULL' as const;
    }
    const player = this.arena.join(name, token);
    if (typeof player !== 'string' && !this.hostId) this.hostId = player.id;
    return player;
  }
  setReady(player: Participant, ready: boolean): LobbyError | null {
    if (this.arena.match) return 'STARTED';
    if (ready) this.ready.add(player.id); else this.ready.delete(player.id);
    return null;
  }
  start(player: Participant): LobbyError | null {
    if (player.id !== this.hostId) return 'NOT_HOST';
    if (this.arena.match) return 'STARTED';
    const players = [...this.arena.players.values()];
    if (players.filter((p) => p.connected).length < 2) return 'NEED_PLAYERS';
    if (players.some((p) => !p.connected || this.settings.requireReady && p.id !== this.hostId && !this.ready.has(p.id))) return 'NOT_READY';
    this.arena.startMatch(); return null;
  }
  back(): LobbyError | null {
    if (!this.arena.match?.ended) return 'STARTED';
    this.arena.returnToLobby(); this.ready.clear(); this.endTicks = 0; return null;
  }
  disconnect(player: Participant, voluntary: boolean, now = performance.now()) {
    if (this.closed) return;
    this.ready.delete(player.id);
    if (voluntary && player.id === this.hostId) { this.closeRoom(this.id); return; }
    this.arena.disconnect(player, now, voluntary);
  }
  step(now: number) {
    if (this.closed) return;
    this.arena.step(now);
    if (!this.arena.players.has(this.hostId)) { this.closeRoom(this.id); return; }
    for (const id of this.ready) if (!this.arena.players.has(id)) this.ready.delete(id);
    if (this.arena.match?.ended && ++this.endTicks >= INTERMISSION_TICKS) this.back();
  }
  snapshot(): WorldSnapshot {
    const snapshot = this.arena.snapshot();
    const lobby: LobbySnapshot = { id: this.id, settings: { ...this.settings }, hostId: this.hostId,
      phase: this.arena.match?.snapshot().state ?? 'LOBBY', addresses: this.addresses(),
      players: snapshot.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, ready: this.ready.has(p.id), pingMs: p.pingMs })) };
    if (snapshot.combat?.match.state === 'MATCH_END') snapshot.combat.match.nextRoundSeconds = Math.ceil((INTERMISSION_TICKS - this.endTicks) / 60);
    return { ...snapshot, lobby };
  }
  dispose() { if (this.closed) return; this.closed = true; this.ready.clear(); this.arena.dispose(); }
}

export class RoomRegistry {
  readonly rooms = new Map<string, Room>();
  private creating = 0;
  private disposed = false;
  constructor(private addresses: () => string[], private onClose: (id: string) => void, private rules?: Readonly<MatchRules>) {}
  async create(settings: RoomSettings): Promise<Room | 'ROOM_LIMIT' | 'ROOM_CLOSED'> {
    if (this.disposed) return 'ROOM_CLOSED';
    if (this.rooms.size + this.creating >= ROOM_LIMIT) return 'ROOM_LIMIT';
    this.creating++;
    try {
      const physics = await createMapWorld(NEON_FACILITY);
      if (this.disposed) { physics.dispose(); return 'ROOM_CLOSED'; }
      let id: string; do { id = randomBytes(4).toString('hex').toUpperCase(); } while (this.rooms.has(id));
      const room = new Room(id, Object.freeze({ ...settings }), new CombatArena(physics, this.rules, Math.random, true), this.addresses, (key) => this.close(key));
      this.rooms.set(id, room); return room;
    } finally { this.creating--; }
  }
  find(id: string): Room | 'NO_ROOM' | 'ROOM_REQUIRED' {
    if (id) return this.rooms.get(id) ?? 'NO_ROOM';
    if (!this.rooms.size) return 'NO_ROOM';
    if (this.rooms.size !== 1) return 'ROOM_REQUIRED';
    return this.rooms.values().next().value!;
  }
  close(id: string) {
    const room = this.rooms.get(id); if (!room) return;
    this.rooms.delete(id); room.dispose(); this.onClose(id);
  }
  step(now: number) { for (const room of this.rooms.values()) room.step(now); }
  dispose() { this.disposed = true; for (const id of this.rooms.keys()) this.close(id); }
}
