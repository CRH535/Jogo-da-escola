import { integer, object, validId, validName } from './validation.js';

export interface RoomSettings { name: string; map: 'neon-facility'; mode: 'ffa'; maxPlayers: number; requireReady: boolean }
export type RoomRequest = { action: 'create'; settings: RoomSettings } | { action: 'join'; id: string };
export interface LobbyPlayer { id: string; name: string; connected: boolean; ready: boolean; pingMs: number | null }
export interface LobbySnapshot {
  id: string; settings: RoomSettings; hostId: string; phase: 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'MATCH_END';
  players: LobbyPlayer[]; addresses: string[];
}
export type LobbyError = 'NO_ROOM' | 'ROOM_REQUIRED' | 'ROOM_CLOSED' | 'STARTED' | 'NOT_HOST' | 'NOT_READY' | 'NEED_PLAYERS' | 'ROOM_LIMIT';
export interface LobbyCommand { epoch: string; roomId: string }
export const ROOM_LIMIT = 4;
export const validRoomId = (value: unknown): value is string => typeof value === 'string' && /^[A-F0-9]{8}$/.test(value);
export function validRoomSettings(v: unknown): v is RoomSettings {
  return object(v) && Object.keys(v).sort().join(',') === 'map,maxPlayers,mode,name,requireReady' && validName(v.name) &&
    v.map === 'neon-facility' && v.mode === 'ffa' && integer(v.maxPlayers, 8) && v.maxPlayers >= 2 && typeof v.requireReady === 'boolean';
}
export function validRoomRequest(v: unknown): v is RoomRequest {
  return object(v) && (v.action === 'create' ? Object.keys(v).sort().join(',') === 'action,settings' && validRoomSettings(v.settings) :
    v.action === 'join' && Object.keys(v).sort().join(',') === 'action,id' && (v.id === '' || validRoomId(v.id)));
}
export function validLobby(v: unknown): v is LobbySnapshot {
  if (!object(v) || !validRoomId(v.id) || !validRoomSettings(v.settings) || !validId(v.hostId) ||
    !['LOBBY', 'COUNTDOWN', 'PLAYING', 'MATCH_END'].includes(String(v.phase)) || !Array.isArray(v.players) ||
    !v.players.length || v.players.length > v.settings.maxPlayers || !Array.isArray(v.addresses) || v.addresses.length > 16 ||
    !v.addresses.every((a: unknown) => typeof a === 'string' && a.length <= 256 && /^https?:\/\/[^\s]+$/.test(a))) return false;
  const ids = new Set<string>();
  return v.players.every((p: unknown) => {
    if (!object(p) || !validId(p.id) || ids.has(p.id) || !validName(p.name) || typeof p.connected !== 'boolean' ||
      typeof p.ready !== 'boolean' || !(p.pingMs === null || integer(p.pingMs, 10000))) return false;
    ids.add(p.id); return true;
  }) && ids.has(v.hostId);
}
