import { WEAPONS, type CombatInput } from '../gameplay/weapons.js';
import type { FeedEntry } from '../gameplay/hud.js';
import type { MatchResult, MatchSnapshot } from '../match/MatchManager.js';
import { finite, integer, object, validId, validName } from './validation.js';

export interface CombatCommand extends CombatInput { lifeId: number }
export interface NetworkFighter {
  id: string; lifeId: number; hp: number; respawnTicks: number; selected: number; magazine: number; reserve: number;
  reloadTicks: number; aiming: boolean; eliminations: number; deaths: number; projectiles: number; hits: number;
}
export interface NetworkMatch extends Omit<MatchSnapshot, 'state'> {
  state: MatchSnapshot['state'] | 'WAITING'; roundId: number; nextRoundSeconds: number;
}
export interface ShotPoint { x: number; y: number; z: number }
interface EventIdentity { id: number; tick: number; actorId: string }
export type NetworkCombatEvent = EventIdentity & (
  { type: 'shot'; weapon: number; from: ShotPoint; impacts: (ShotPoint & { hit: boolean })[] } |
  { type: 'reload' | 'loaded'; weapon: number } |
  { type: 'elimination'; victimId: string; position: ShotPoint }
);
export interface CombatWorld { fighters: NetworkFighter[]; match: NetworkMatch; feed: readonly FeedEntry[]; events: readonly NetworkCombatEvent[] }
export const INTERMISSION_TICKS = 900;
export const COMBAT_EVENT_LIMIT = 64;
export function validCombatCommand(value: unknown): value is CombatCommand {
  return object(value) && Object.keys(value).sort().join(',') === 'aim,fire,lifeId,pressed,reload,select' &&
    integer(value.lifeId) && value.lifeId > 0 && typeof value.fire === 'boolean' && typeof value.pressed === 'boolean' &&
    typeof value.reload === 'boolean' && typeof value.aim === 'boolean' && Number.isInteger(value.select) && Number(value.select) >= -1 && Number(value.select) <= 2;
}
const point = (v: unknown): v is ShotPoint => object(v) && finite(v.x, 120) && finite(v.y, 120) && finite(v.z, 120);
const stats = (v: Record<string, unknown>) => integer(v.eliminations, 100000) && integer(v.deaths, 100000) && integer(v.projectiles, 1000000) && integer(v.hits, 1000000) && v.hits <= v.projectiles;
function validFighter(value: unknown): value is NetworkFighter {
  if (!object(value) || !validId(value.id) || !integer(value.lifeId) || value.lifeId < 1 || !integer(value.selected, 2)) return false;
  const weapon = WEAPONS[value.selected]!;
  return integer(value.hp, 100) && integer(value.respawnTicks, 180) && (value.hp === 0 || value.respawnTicks === 0) &&
    integer(value.magazine, weapon.magazine) && integer(value.reserve, weapon.reserve) && integer(value.reloadTicks, weapon.reload) && typeof value.aiming === 'boolean' && stats(value);
}
function validResult(value: unknown): value is MatchResult {
  if (!object(value) || !['time', 'eliminations'].includes(String(value.reason)) || !validId(value.winnerId) || !integer(value.elapsedSeconds, 86400) ||
    !Array.isArray(value.players) || !value.players.length || value.players.length > 8) return false;
  const ids = new Set<string>();
  return value.players.every((p: unknown) => {
    if (!object(p) || !validId(p.id) || ids.has(p.id) || !validName(p.name) || !stats(p) || p.score !== Number(p.eliminations) * 100 ||
      typeof p.local !== 'boolean' || !(p.pingMs === null || integer(p.pingMs, 10000))) return false;
    ids.add(p.id); return true;
  }) && ids.has(value.winnerId);
}
function validMatch(v: unknown): v is NetworkMatch {
  return object(v) && ['WAITING', 'COUNTDOWN', 'PLAYING', 'MATCH_END'].includes(String(v.state)) && integer(v.roundId) &&
    integer(v.countdown, 60) && typeof v.go === 'boolean' && integer(v.remainingSeconds, 86400) && integer(v.eliminationLimit, 100000) &&
    integer(v.nextRoundSeconds, INTERMISSION_TICKS / 60) && (v.state === 'MATCH_END' ? validResult(v.result) : v.result === null);
}
function validEvent(v: unknown, tick: number): v is NetworkCombatEvent {
  if (!object(v) || !integer(v.id) || !integer(v.tick, tick) || !validId(v.actorId)) return false;
  if (v.type === 'elimination') return validId(v.victimId) && point(v.position);
  if (!integer(v.weapon, 2)) return false;
  if (v.type === 'reload' || v.type === 'loaded') return true;
  return v.type === 'shot' && point(v.from) && Array.isArray(v.impacts) && v.impacts.length > 0 && v.impacts.length <= WEAPONS[v.weapon]!.pellets &&
    v.impacts.every((p: unknown) => point(p) && typeof (p as unknown as Record<string, unknown>).hit === 'boolean');
}
export function validCombatWorld(v: unknown, players: { id: string }[], tick: number): v is CombatWorld {
  if (!object(v) || !Array.isArray(v.fighters) || v.fighters.length !== players.length || !validMatch(v.match) ||
    !Array.isArray(v.events) || v.events.length > COMBAT_EVENT_LIMIT || !v.events.every((e: unknown) => validEvent(e, tick)) ||
    !Array.isArray(v.feed) || v.feed.length > 4) return false;
  for (let index = 1; index < v.events.length; index++) if (v.events[index]!.id <= v.events[index - 1]!.id) return false;
  const ids = new Set<string>();
  return v.fighters.every((fighter: unknown) => {
    if (!validFighter(fighter) || ids.has(fighter.id) || !players.some((p) => p.id === fighter.id)) return false;
    ids.add(fighter.id); return true;
  }) && v.feed.every((entry: unknown) => {
    if (!object(entry) || !integer(entry.id) || !integer(entry.expiresAtTick) || !WEAPONS.some((w) => w.name === entry.equipment)) return false;
    return [entry.attacker, entry.victim].every((actor) => object(actor) && validId(actor.id) && validName(actor.name) && actor.kind === 'player');
  });
}
