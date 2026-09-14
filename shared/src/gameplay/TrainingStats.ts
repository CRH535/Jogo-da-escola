import type { FeedActor, FeedEntry, HudSnapshot, ScoreRow } from './hud.js';

export const FEED_LIMIT = 4;
export const FEED_LIFETIME_TICKS = 300;
export const TRAINING_ELIMINATION_POINTS = 100;

export class TrainingStats {
  private ticks = 0;
  private nextId = 0;
  private kills = 0;
  private defeats = 0;
  private feed: readonly FeedEntry[] = [];
  private player: FeedActor;
  private participants: ScoreRow[];
  constructor(name = 'Player', bots: readonly FeedActor[] = []) {
    this.player = { id: 'local-player', name, kind: 'player' };
    this.participants = bots.map((bot) => ({ id: bot.id, name: bot.name, eliminations: 0, deaths: 0, score: 0, pingMs: null, local: false, bot: true }));
  }
  get eliminations() { return this.kills; }
  get leadingEliminations() {
    let leading = this.kills;
    for (const row of this.participants) leading = Math.max(leading, row.eliminations);
    return leading;
  }
  setPlayerName(name: string) { this.player = { ...this.player, name }; }
  step() {
    this.ticks++;
    if (this.feed[0] && this.feed[0].expiresAtTick <= this.ticks) this.feed = this.feed.filter((entry) => entry.expiresAtTick > this.ticks);
  }
  targetEliminated(targetId: string, equipment: string) {
    this.kills++;
    this.append(this.player, { id: targetId, name: targetId, kind: 'target' }, equipment);
  }
  playerEliminated() {
    this.defeats++;
    this.append({ id: 'energy-field', name: 'Campo de energia', kind: 'environment' }, this.player, null);
  }
  actorEliminated(attacker: FeedActor, victim: FeedActor, equipment: string) {
    if (attacker.id === this.player.id) { this.kills++; attacker = this.player; }
    if (victim.id === this.player.id) { this.defeats++; victim = this.player; }
    this.participants = this.participants.map((row) => ({ ...row,
      eliminations: row.eliminations + Number(row.id === attacker.id), deaths: row.deaths + Number(row.id === victim.id),
      score: row.score + Number(row.id === attacker.id) * TRAINING_ELIMINATION_POINTS }));
    this.append(attacker, victim, equipment);
  }
  private append(attacker: FeedActor, victim: FeedActor, equipment: string | null) {
    const entry: FeedEntry = { id: ++this.nextId, attacker, victim, equipment, expiresAtTick: this.ticks + FEED_LIFETIME_TICKS };
    this.feed = [...this.feed.slice(-(FEED_LIMIT - 1)), entry];
  }
  snapshot(): HudSnapshot {
    const score = this.kills * TRAINING_ELIMINATION_POINTS;
    return { mode: this.participants.length ? 'bots' : 'training', clock: { kind: 'elapsed', seconds: Math.floor(this.ticks / 60) }, score, deaths: this.defeats, feed: this.feed,
      players: [{ id: this.player.id, name: this.player.name, eliminations: this.kills, deaths: this.defeats, score, pingMs: null, local: true }, ...this.participants] };
  }
  reset() {
    this.ticks = 0; this.kills = 0; this.defeats = 0; this.feed = [];
    this.participants = this.participants.map((row) => ({ ...row, eliminations: 0, deaths: 0, score: 0 }));
  }
}
