import type { PlayerController } from '../simulation/player/movement.js';
import type { Life } from '../gameplay/Life.js';
import type { WeaponManager } from '../gameplay/weapons.js';

export type BotDifficulty = 'easy' | 'normal' | 'hard';
export type BotState = 'PATROL' | 'SEARCH' | 'CHASE' | 'ATTACK' | 'RESPAWN';
export interface BotOptions { count: number; difficulty: BotDifficulty }
export interface CombatActor {
  id: string; name: string; bot: boolean; controller: PlayerController;
  life: Life; weapons: WeaponManager; yaw: number; pitch: number;
}
export const BOT_PROFILES = {
  easy: { reaction: 54, spread: 0.095, turn: 1.8, range: 25, shotInterval: 24, speed: 0.65, strafe: false },
  normal: { reaction: 30, spread: 0.06, turn: 2.8, range: 30, shotInterval: 16, speed: 0.8, strafe: true },
  hard: { reaction: 18, spread: 0.035, turn: 3.8, range: 34, shotInterval: 12, speed: 0.95, strafe: true },
} as const;
export function normalizeBotOptions(options: BotOptions): BotOptions {
  return { count: Number.isFinite(options.count) ? Math.max(1, Math.min(7, Math.trunc(options.count))) : 3,
    difficulty: Object.hasOwn(BOT_PROFILES, options.difficulty) ? options.difficulty : 'normal' };
}
