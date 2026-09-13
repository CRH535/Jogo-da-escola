import { MOVEMENT } from './player/movement.js';

export class FixedStep {
  private accumulator = 0;
  get alpha() { return this.accumulator / MOVEMENT.step; }
  reset() { this.accumulator = 0; }
  advance(elapsed: number, step: () => void) {
    if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
    // Drop excess wall time after stalls instead of simulating a long catch-up burst.
    this.accumulator += Math.min(elapsed, MOVEMENT.step * 6);
    let count = 0;
    while (this.accumulator + 1e-9 >= MOVEMENT.step && count < 6) {
      step();
      this.accumulator = Math.max(0, this.accumulator - MOVEMENT.step);
      count++;
    }
    return count;
  }
}
