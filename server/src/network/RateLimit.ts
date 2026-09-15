export class RateLimit {
  private tokens: number;
  private last: number;
  constructor(private rate: number, private capacity: number, now = performance.now()) { this.tokens = capacity; this.last = now; }
  take(now = performance.now()) {
    this.tokens = Math.min(this.capacity, this.tokens + Math.max(0, now - this.last) * this.rate / 1000); this.last = now;
    if (this.tokens < 1) return false;
    this.tokens--; return true;
  }
}
