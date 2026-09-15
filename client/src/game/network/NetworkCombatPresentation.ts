import type { PerspectiveCamera, Scene } from 'three';
import { WEAPONS } from '@neon-strike/shared/gameplay';
import type { NetworkFighter, WorldSnapshot } from '@neon-strike/shared/network';
import type { Preferences } from '../../settings/preferences';
import { AudioManager } from '../../audio/AudioManager';
import { ParticleManager } from '../combat/ParticleManager';
import { WeaponView } from '../combat/WeaponView';
import type { TrainingReadout } from '../combat/TrainingRuntime';

export class NetworkCombatPresentation {
  private audio: AudioManager;
  private effects: ParticleManager;
  private view: WeaponView;
  private fighter: NetworkFighter | undefined;
  private lastEvent = -1;
  private hitUntil = 0;
  private damageUntil = 0;
  private audible = false;
  constructor(scene: Scene, camera: PerspectiveCamera, preferences: Preferences) {
    this.audio = new AudioManager(preferences.audio);
    this.effects = new ParticleManager(scene); this.view = new WeaponView(camera);
    this.view.root.visible = false;
  }
  reset() { this.lastEvent = -1; this.fighter = undefined; this.effects.reset(); this.view.reset(); this.hitUntil = 0; this.damageUntil = 0; }
  receive(snapshot: WorldSnapshot, id: string) {
    const combat = snapshot.combat;
    const next = combat?.fighters.find((p) => p.id === id);
    if (!combat || !next) return;
    const previous = this.fighter;
    if (previous && previous.lifeId !== next.lifeId) {
      this.view.reset(); this.hitUntil = 0; this.damageUntil = 0;
      if (previous.hp === 0 && this.audible) this.audio.play('respawn');
    } else if (previous && next.hp < previous.hp) {
      this.damageUntil = snapshot.tick + 18;
      if (this.audible) this.audio.play(next.hp ? 'damage' : 'death');
    }
    this.fighter = next;
    // A welcome includes recent history for state recovery, not for replaying old sounds.
    if (this.lastEvent < 0) { this.lastEvent = Math.max(0, ...combat.events.map((e) => e.id)); return; }
    for (const event of combat.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      if (snapshot.tick - event.tick > 120) continue;
      const local = event.actorId === id;
      if (event.type === 'shot') {
        if (local) this.view.shot();
        if (this.audible && (local || Math.hypot(event.from.x - this.view.muzzle.x, event.from.z - this.view.muzzle.z) < 22)) this.audio.play('shot', event.weapon);
        for (const impact of event.impacts) {
          this.effects.trace(local ? this.view.muzzle : event.from, impact.x, impact.y, impact.z);
          this.effects.burst(impact.x, impact.y, impact.z, 4);
        }
        if (local && event.impacts.some((p) => p.hit)) { this.hitUntil = snapshot.tick + 10; if (this.audible) this.audio.play('hit'); }
      } else if (event.type === 'elimination') {
        this.effects.burst(event.position.x, event.position.y, event.position.z, 48);
      } else if (local && this.audible) this.audio.play(event.type);
    }
  }
  readout(snapshot: WorldSnapshot, id: string): TrainingReadout | null {
    const combat = snapshot.combat; const fighter = combat?.fighters.find((p) => p.id === id);
    if (!combat || !fighter) return null;
    const weapon = WEAPONS[fighter.selected]!;
    const players = snapshot.players.map((p) => {
      const stats = combat.fighters.find((f) => f.id === p.id)!;
      return { id: p.id, name: p.name, eliminations: stats.eliminations, deaths: stats.deaths, score: stats.eliminations * 100, pingMs: p.pingMs, local: p.id === id };
    });
    const match = combat.match;
    return { hp: fighter.hp, respawn: Math.ceil(fighter.respawnTicks / 60), selected: fighter.selected, name: weapon.name,
      magazine: fighter.magazine, reserve: fighter.reserve, capacity: weapon.magazine, reload: fighter.reloadTicks / 60,
      reloadProgress: fighter.reloadTicks ? 1 - fighter.reloadTicks / weapon.reload : 0, aiming: fighter.aiming,
      hits: fighter.hits, eliminations: fighter.eliminations, hit: snapshot.tick < this.hitUntil, damaged: snapshot.tick < this.damageUntil,
      waiting: match.state === 'WAITING', nextRoundSeconds: match.nextRoundSeconds,
      hud: { mode: 'network', clock: { kind: 'remaining', seconds: match.remainingSeconds }, score: fighter.eliminations * 100,
        deaths: fighter.deaths, players, feed: combat.feed },
      ...(match.state !== 'WAITING' ? { match: { ...match, state: match.state,
        result: match.result ? { ...match.result, players: match.result.players.map((p) => ({ ...p, local: p.id === id })) } : null } } : {}),
    };
  }
  update(delta: number) { this.effects.update(delta); if (this.fighter) this.view.update(delta, this.fighter, this.fighter.hp > 0); }
  get aiming() { return Boolean(this.fighter?.aiming && this.fighter.reloadTicks === 0); }
  unlockAudio() { this.audio.unlock(); }
  setActive(active: boolean) { this.audible = active; if (!active) this.audio.silence(); }
  setPreferences(preferences: Preferences) { this.audio.setVolume(preferences.audio); }
  dispose() { this.audio.dispose(); this.effects.dispose(); this.view.dispose(); }
}
