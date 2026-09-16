import type { MovementInput, PlayerCheckpoint } from '../simulation/player/movement.js';
import { object, finite, integer, validName } from './validation.js';
import { validCombatCommand, validCombatWorld, type CombatCommand, type CombatWorld } from './combat.js';
import { validLobby, type LobbySnapshot, type LobbyCommand, type LobbyError, type RoomRequest } from './lobby.js';
export * from './lobby.js';
export { validName } from './validation.js';
export * from './combat.js';
export { SnapshotBuffer } from './SnapshotBuffer.js';
export type { RemotePose } from './SnapshotBuffer.js';

export const NETWORK_VERSION = 3;
export const NET = { players: 8, inputHz: 30, snapshotHz: 20, queueLimit: 12, batchLimit: 4, recoveryMs: 10000, staleMs: 1500 } as const;
export interface PlayerCommand extends MovementInput { seq: number; pitch: number; combat?: CombatCommand }
export interface InputPacket { epoch: string; commands: PlayerCommand[] }
export interface NetworkPlayer {
  id: string; name: string; slot: number; connected: boolean; active: boolean; pingMs: number | null;
  ack: number; pose: PlayerCheckpoint; pitch: number;
}
export interface WorldSnapshot { tick: number; players: NetworkPlayer[]; combat?: CombatWorld; lobby?: LobbySnapshot }
export interface Welcome { id: string; token: string; epoch: string; snapshot: WorldSnapshot }
export interface JoinAuth { version: number; name: string; token?: string; room?: RoomRequest }
export type NetworkError = 'INCOMPATIBLE' | 'INVALID_NAME' | 'FULL' | 'EXPIRED' | 'IN_USE' | 'RATE_LIMIT' | 'INVALID_INPUT' | LobbyError;
export interface ServerEvents {
  'network:welcome': (welcome: Welcome) => void;
  'world:state': (snapshot: WorldSnapshot) => void;
  'network:error': (error: NetworkError) => void;
  'network:probe': (ack: () => void) => void;
  'lobby:error': (error: LobbyError) => void;
}
export interface ClientEvents {
  'player:input': (packet: InputPacket) => void;
  'player:active': (packet: { epoch: string; active: boolean }) => void;
  'player:leave': () => void;
  'lobby:ready': (packet: LobbyCommand & { ready: boolean }) => void;
  'lobby:start': (packet: LobbyCommand) => void;
  'lobby:return': (packet: LobbyCommand) => void;
}
export function validCommand(value: unknown): value is PlayerCommand {
  if (!object(value)) return false;
  const keys = Object.keys(value).sort().join(',');
  if (keys !== 'forward,jump,pitch,right,seq,sprint,yaw' && !(keys === 'combat,forward,jump,pitch,right,seq,sprint,yaw' && validCombatCommand(value.combat))) return false;
  return integer(value.seq) && value.seq > 0 && finite(value.forward, 1) && finite(value.right, 1) && finite(value.yaw, Math.PI) &&
    finite(value.pitch, Math.PI / 2) && typeof value.sprint === 'boolean' && typeof value.jump === 'boolean';
}
export function validInput(value: unknown): value is InputPacket {
  return object(value) && Object.keys(value).sort().join(',') === 'commands,epoch' && typeof value.epoch === 'string' && value.epoch.length === 36 &&
    Array.isArray(value.commands) && value.commands.length > 0 && value.commands.length <= NET.batchLimit && value.commands.every(validCommand);
}
export function validPose(value: unknown): value is PlayerCheckpoint {
  return object(value) && finite(value.x, 24) && finite(value.z, 20) && finite(value.y, 24) && finite(value.vx, 9.01) && finite(value.vz, 9.01) &&
    finite(value.vy, 35) && finite(value.yaw, Math.PI) && typeof value.grounded === 'boolean' && typeof value.jumpHeld === 'boolean';
}
export function validSnapshot(value: unknown): value is WorldSnapshot {
  if (!object(value) || !integer(value.tick) || !Array.isArray(value.players) || value.players.length > NET.players) return false;
  const ids = new Set<string>(); const slots = new Set<number>();
  return value.players.every((player: unknown) => {
    if (!object(player) || typeof player.id !== 'string' || player.id.length !== 36 || !validName(player.name) || !integer(player.slot, 7) ||
      !integer(player.ack) || typeof player.connected !== 'boolean' || typeof player.active !== 'boolean' || !validPose(player.pose) ||
      !finite(player.pitch, Math.PI / 2) || !(player.pingMs === null || integer(player.pingMs, 10000)) || ids.has(player.id) || slots.has(player.slot)) return false;
    ids.add(player.id); slots.add(player.slot); return true;
  }) && (value.combat === undefined || validCombatWorld(value.combat, value.players as NetworkPlayer[], value.tick)) &&
    (value.lobby === undefined || validLobby(value.lobby) && value.lobby.players.length === value.players.length &&
      value.lobby.players.every((p) => ids.has(p.id)));
}
export function validWelcome(value: unknown): value is Welcome {
  return object(value) && typeof value.id === 'string' && typeof value.token === 'string' && /^[\w-]{43}$/.test(value.token) &&
    typeof value.epoch === 'string' && value.epoch.length === 36 && validSnapshot(value.snapshot) && value.snapshot.players.some((p) => p.id === value.id);
}
