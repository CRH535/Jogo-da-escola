export interface ScoreRow {
  id: string; name: string; eliminations: number; deaths: number; score: number;
  pingMs: number | null; local: boolean; bot?: boolean;
}
export interface FeedActor { id: string; name: string; kind: 'player' | 'bot' | 'target' | 'environment' }
export interface FeedEntry {
  id: number; attacker: FeedActor; victim: FeedActor; equipment: string | null; expiresAtTick: number;
}
export interface HudSnapshot {
  mode?: 'training' | 'bots';
  clock: { kind: 'elapsed' | 'remaining'; seconds: number };
  score: number; deaths: number; players: readonly ScoreRow[]; feed: readonly FeedEntry[];
}
export function sortScoreboard(rows: readonly ScoreRow[]): ScoreRow[] {
  return [...rows].sort((a, b) => b.score - a.score || b.eliminations - a.eliminations || a.deaths - b.deaths ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function formatDuration(seconds: number) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.min(359999, Math.floor(seconds))) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const rest = (total % 60).toString().padStart(2, '0');
  return hours ? `${hours}:${minutes.toString().padStart(2, '0')}:${rest}` : `${minutes.toString().padStart(2, '0')}:${rest}`;
}
