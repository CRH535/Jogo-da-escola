import { sortScoreboard, type ScoreRow } from '../gameplay/hud.js';

export interface MatchRules { mode: 'ffa'; countdownTicks: number; durationTicks: number; eliminationLimit: number }
export const FFA_RULES: Readonly<MatchRules> = Object.freeze({ mode: 'ffa', countdownTicks: 180, durationTicks: 36000, eliminationLimit: 30 });
export interface MatchRow extends ScoreRow { projectiles: number; hits: number }
export interface MatchResult {
  reason: 'time' | 'eliminations'; winnerId: string; elapsedSeconds: number;
  players: readonly Readonly<MatchRow>[];
}
export interface MatchSnapshot {
  state: 'COUNTDOWN' | 'PLAYING' | 'MATCH_END'; countdown: number; go: boolean;
  remainingSeconds: number; eliminationLimit: number; result: Readonly<MatchResult> | null;
}
export function accuracyPercent(hits: number, projectiles: number) {
  return projectiles > 0 ? Math.max(0, Math.min(100, Math.round(hits / projectiles * 100))) : 0;
}

// Driven only by simulation ticks. Pausing the executor also pauses both clocks.
export class MatchManager {
  readonly rules: Readonly<MatchRules>;
  private phase: MatchSnapshot['state'] = 'COUNTDOWN';
  private countdownTicks = 0;
  private elapsedTicks = 0;
  private result: Readonly<MatchResult> | null = null;
  constructor(rules: Readonly<MatchRules> = FFA_RULES) {
    if (rules.mode !== 'ffa' || ![rules.countdownTicks, rules.durationTicks, rules.eliminationLimit].every((n) => Number.isSafeInteger(n) && n > 0)) {
      throw new Error('Invalid match rules');
    }
    this.rules = Object.freeze({ ...rules });
  }
  get playing() { return this.phase === 'PLAYING'; }
  get ended() { return this.phase === 'MATCH_END'; }
  advanceCountdown() {
    if (this.phase === 'COUNTDOWN' && ++this.countdownTicks >= this.rules.countdownTicks) this.phase = 'PLAYING';
  }
  afterTick(leadingEliminations: number, getPlayers: () => readonly MatchRow[]) {
    if (!this.playing) return;
    this.elapsedTicks++;
    const limit = leadingEliminations >= this.rules.eliminationLimit;
    if (!limit && this.elapsedTicks < this.rules.durationTicks) return;
    const players = getPlayers();
    const ranked = sortScoreboard(players).map((row) => Object.freeze({ ...players.find((player) => player.id === row.id)! }));
    this.result = Object.freeze({ reason: limit ? 'eliminations' : 'time', winnerId: ranked[0]?.id ?? '',
      elapsedSeconds: Math.floor(this.elapsedTicks / 60), players: Object.freeze(ranked) });
    this.phase = 'MATCH_END';
  }
  snapshot(): MatchSnapshot {
    return { state: this.phase, countdown: this.phase === 'COUNTDOWN' ? Math.ceil((this.rules.countdownTicks - this.countdownTicks) / 60) : 0,
      go: this.playing && this.elapsedTicks < 45, remainingSeconds: Math.ceil(Math.max(0, this.rules.durationTicks - this.elapsedTicks) / 60),
      eliminationLimit: this.rules.eliminationLimit, result: this.result };
  }
  reset() { this.phase = 'COUNTDOWN'; this.countdownTicks = 0; this.elapsedTicks = 0; this.result = null; }
}
