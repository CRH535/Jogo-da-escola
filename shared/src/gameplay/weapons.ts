export const WEAPONS = [
  { id: 'nx7', name: 'NX-7 Pulse', automatic: true, magazine: 30, reserve: 150, cooldown: 8, reload: 84, pellets: 1, damage: 20, range: 55, falloff: 25, spread: 0.008, aim: false },
  { id: 'vx', name: 'VX Scatter', automatic: false, magazine: 6, reserve: 36, cooldown: 48, reload: 108, pellets: 8, damage: 14, range: 22, falloff: 7, spread: 0.085, aim: false },
  { id: 'arc9', name: 'ARC-9', automatic: false, magazine: 5, reserve: 25, cooldown: 54, reload: 102, pellets: 1, damage: 80, range: 90, falloff: 70, spread: 0.002, aim: true },
] as const;
export type Weapon = typeof WEAPONS[number];
export interface CombatInput { fire: boolean; pressed: boolean; reload: boolean; select: number; aim: boolean }
export const IDLE_COMBAT: Readonly<CombatInput> = { fire: false, pressed: false, reload: false, select: -1, aim: false };
export function damageAtDistance(weapon: Weapon, distance: number) {
  if (!Number.isFinite(distance) || distance < 0 || distance > weapon.range) return 0;
  const falloff = Math.max(0, (distance - weapon.falloff) / (weapon.range - weapon.falloff));
  return Math.max(1, Math.round(weapon.damage * (1 - falloff * 0.85)));
}

// All durations are simulation ticks (60 Hz), never wall-clock timers.
export class WeaponManager {
  selected = 0;
  ammo = WEAPONS.map((weapon) => ({ magazine: Number(weapon.magazine), reserve: Number(weapon.reserve) }));
  cooldown = 0;
  reloadTicks = 0;
  aiming = false;
  get weapon(): Weapon { return WEAPONS[this.selected]!; }
  get current() { return this.ammo[this.selected]!; }
  reset() {
    this.selected = 0; this.cooldown = 0; this.reloadTicks = 0; this.aiming = false;
    WEAPONS.forEach((weapon, index) => { Object.assign(this.ammo[index]!, { magazine: weapon.magazine, reserve: weapon.reserve }); });
  }
  cancel() { this.reloadTicks = 0; this.aiming = false; }
  step(input: CombatInput, alive: boolean): 'shot' | 'reload' | 'loaded' | null {
    if (this.cooldown > 0) this.cooldown--;
    if (!alive) { this.cancel(); return null; }
    let event: 'loaded' | null = null;
    if (Number.isInteger(input.select) && input.select >= 0 && input.select < WEAPONS.length && input.select !== this.selected) {
      this.selected = input.select;
      this.cancel();
      this.cooldown = Math.max(this.cooldown, 12);
    }
    this.aiming = input.aim === true && this.weapon.aim;
    if (this.reloadTicks > 0) {
      if (--this.reloadTicks > 0) return null;
      const transfer = Math.min(this.weapon.magazine - this.current.magazine, this.current.reserve);
      this.current.magazine += transfer; this.current.reserve -= transfer;
      event = 'loaded';
    }
    if (input.reload && this.current.magazine < this.weapon.magazine && this.current.reserve > 0) {
      this.reloadTicks = this.weapon.reload; this.aiming = false;
      return 'reload';
    }
    if (this.cooldown === 0 && this.current.magazine > 0 && (input.pressed || this.weapon.automatic && input.fire)) {
      this.current.magazine--; this.cooldown = this.weapon.cooldown;
      return 'shot';
    }
    return event;
  }
}
