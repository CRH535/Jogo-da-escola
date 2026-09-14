import type { PerspectiveCamera, Scene } from 'three';
import type { MapWorld } from '@neon-strike/shared/physics';
import { TrainingSession, type CombatSnapshot } from '@neon-strike/shared/gameplay';
import { BotSession, type BotOptions } from '@neon-strike/shared/bots';
import { FFA_RULES, type MatchRules, type MatchSnapshot } from '@neon-strike/shared/match';
import type { HudSnapshot } from '@neon-strike/shared/hud';
import type { PlayerController } from '@neon-strike/shared/simulation';
import type { Preferences } from '../../settings/preferences';
import { AudioManager } from '../../audio/AudioManager';
import type { InputManager } from '../player/InputManager';
import { ParticleManager } from './ParticleManager';
import { WeaponView } from './WeaponView';
import { createTrainingObjects } from './createTrainingObjects';
import { createBotObjects } from './createBotObjects';

export interface TrainingReadout extends CombatSnapshot { hit: boolean; damaged: boolean; hud: HudSnapshot; match?: MatchSnapshot }
export class TrainingRuntime {
  readonly session: TrainingSession | BotSession;
  private audio: AudioManager;
  private effects: ParticleManager;
  private view: WeaponView;
  private objects;
  private ticks = 0;
  private hitTicks = 0;
  private damageTicks = 0;
  constructor(physics: MapWorld, player: PlayerController, scene: Scene, camera: PerspectiveCamera,
    private input: InputManager, preferences: Preferences, private onReadout: (snapshot: TrainingReadout) => void, bots?: BotOptions, rules: Readonly<MatchRules> = FFA_RULES) {
    this.session = bots ? new BotSession(physics, player, bots, Math.random, rules) : new TrainingSession(physics.world, player);
    this.session.stats.setPlayerName(preferences.profile.name || 'Player');
    this.audio = new AudioManager(preferences.audio); this.effects = new ParticleManager(scene);
    this.view = new WeaponView(camera);
    if (this.session instanceof BotSession) this.objects = createBotObjects(scene, this.session);
    else {
      const session = this.session; const targets = createTrainingObjects(scene);
      this.objects = { update: (_delta: number, _alpha: number) => targets.update(session), dispose: targets.dispose };
    }
    this.publish();
  }
  get alive() { return this.session.life.alive; }
  get playing() { return !(this.session instanceof BotSession) || this.session.playing; }
  get ended() { return this.session instanceof BotSession && this.session.match?.ended; }
  get aiming() { return this.session.weapons.aiming && this.session.weapons.reloadTicks === 0; }
  beforePhysics() { if (this.session instanceof BotSession) this.session.beforePhysics(); }
  afterPhysics() { if (this.session instanceof BotSession) this.session.afterPhysics(); }
  botDebug() {
    return this.session instanceof BotSession ? this.session.bots.map((bot) => ({ id: bot.actor.id, state: bot.state,
      x: bot.actor.controller.state.x, y: bot.actor.controller.state.y, z: bot.actor.controller.state.z,
      hp: bot.actor.life.hp, magazine: bot.actor.weapons.current.magazine, target: bot.targetId })) : [];
  }
  step() {
    const wasPlaying = this.playing;
    if (this.hitTicks > 0) this.hitTicks--;
    if (this.damageTicks > 0) this.damageTicks--;
    this.session.step(this.input.readCombat(), this.input.yaw, this.input.pitch);
    let hitSound = false;
    let botSound = false;
    for (const event of this.session.events) {
      switch (event.type) {
        case 'bot-impact':
          this.effects.trace(event.from, event.x, event.y, event.z);
          this.effects.burst(event.x, event.y, event.z, 2);
          botSound ||= Math.hypot(event.from.x - this.view.muzzle.x, event.from.z - this.view.muzzle.z) < 22;
          break;
        case 'shot': this.view.shot(); this.audio.play('shot', this.session.weapons.selected); break;
        case 'reload': case 'loaded': this.audio.play(event.type); break;
        case 'impact':
          this.effects.trace(this.view.muzzle, event.x, event.y, event.z);
          this.effects.burst(event.x, event.y, event.z, 4);
          if (event.hit) { this.hitTicks = 10; hitSound = true; }
          break;
        case 'elimination': this.effects.burst(event.x, event.y, event.z, 48); break;
        case 'damage': this.damageTicks = 18; this.audio.play('damage'); break;
        case 'death': this.input.clearGameplay(); this.audio.play('death'); break;
        case 'respawn':
          this.input.clearGameplay(); this.input.yaw = this.session instanceof BotSession ? this.session.actors[0]!.yaw : 0; this.input.pitch = 0; this.view.reset();
          this.hitTicks = 0; this.damageTicks = 0; this.audio.play('respawn'); break;
      }
    }
    if (!this.alive) this.input.clearGameplay();
    if (hitSound) this.audio.play('hit');
    if (botSound) this.audio.play('shot', 0);
    // React receives at most 10 snapshots/sec; simulation and effects remain outside React.
    if (++this.ticks % 6 === 0 || wasPlaying !== this.playing) this.publish();
  }
  private publish() {
    const match = this.session instanceof BotSession ? this.session.match?.snapshot() : undefined;
    const hud = this.session.stats.snapshot();
    if (match) hud.clock = { kind: 'remaining', seconds: match.remainingSeconds };
    this.onReadout({ ...this.session.snapshot(), hit: this.hitTicks > 0, damaged: this.damageTicks > 0, hud, ...(match ? { match } : {}) });
  }
  update(delta: number, alpha = 1) {
    this.objects.update(delta, alpha); this.effects.update(delta);
    this.view.update(delta, this.session.weapons, this.alive);
  }
  unlockAudio() { this.audio.unlock(); }
  pause() { this.audio.silence(); this.session.weapons.aiming = false; this.publish(); }
  setPreferences(preferences: Preferences) {
    this.audio.setVolume(preferences.audio); this.session.stats.setPlayerName(preferences.profile.name || 'Player'); this.publish();
  }
  reset() {
    this.session.reset(); this.effects.reset(); this.view.reset(); this.audio.silence();
    this.hitTicks = 0; this.damageTicks = 0; this.ticks = 0; this.publish();
  }
  dispose() { this.audio.dispose(); this.effects.dispose(); this.view.dispose(); this.objects.dispose(); this.session.dispose(); }
}
