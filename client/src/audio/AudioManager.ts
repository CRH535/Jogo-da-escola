import type { Preferences } from '../settings/preferences';

type Cue = 'shot' | 'reload' | 'loaded' | 'hit' | 'damage' | 'death' | 'respawn';
// Original synthesized placeholders; no external recordings or copyrighted samples.
export class AudioManager {
  private context: AudioContext | undefined;
  private output: GainNode | undefined;
  private voices = new Map<OscillatorNode, GainNode>();
  private disposed = false;
  private warned = false;
  constructor(private volume: Preferences['audio']) {}
  unlock() {
    if (this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.output = this.context.createGain();
        this.output.connect(this.context.destination); this.setVolume(this.volume);
      }
      void this.context.resume().catch(() => this.warn());
    } catch { this.warn(); }
  }
  private warn() {
    if (!this.warned && !this.disposed) { this.warned = true; console.warn('[AUDIO] Audio unavailable; continuing silently.'); }
  }
  setVolume(volume: Preferences['audio']) {
    this.volume = volume;
    if (this.context && this.output) this.output.gain.setTargetAtTime(volume.master * volume.effects / 10000 * 0.14, this.context.currentTime, 0.02);
  }
  play(cue: Cue, weapon = 0) {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.output || this.disposed || !this.volume.master || !this.volume.effects) return;
    if (this.voices.size >= 12) this.stopVoice(this.voices.keys().next().value!);
    const oscillator = context.createOscillator(); const gain = context.createGain();
    const now = context.currentTime;
    const frequency = { shot: [210, 95, 490][weapon]!, reload: 140, loaded: 620, hit: 980, damage: 85, death: 60, respawn: 740 }[cue];
    const duration = cue === 'death' ? 0.32 : cue === 'respawn' ? 0.24 : 0.09;
    oscillator.type = cue === 'shot' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * (cue === 'respawn' ? 1.5 : 0.35)), now + duration);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.65, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain); gain.connect(this.output); this.voices.set(oscillator, gain);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator); };
    oscillator.start(now); oscillator.stop(now + duration + 0.01);
  }
  private stopVoice(voice: OscillatorNode) {
    voice.onended = null; voice.stop(); voice.disconnect(); this.voices.get(voice)?.disconnect(); this.voices.delete(voice);
  }
  silence() { for (const voice of this.voices.keys()) this.stopVoice(voice); }
  dispose() {
    this.disposed = true; this.silence(); this.output?.disconnect();
    void this.context?.close().catch(() => {});
  }
}
