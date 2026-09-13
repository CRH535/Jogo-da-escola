export class Life {
  hp = 100;
  respawnTicks = 0;
  get alive() { return this.hp > 0; }
  reset() { this.hp = 100; this.respawnTicks = 0; }
  damage(amount: number) {
    if (!this.alive || !Number.isFinite(amount) || amount <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (!this.alive) this.respawnTicks = 180;
    return true;
  }
  step() {
    if (this.alive || this.respawnTicks === 0) return false;
    if (--this.respawnTicks > 0) return false;
    this.reset();
    return true;
  }
}
