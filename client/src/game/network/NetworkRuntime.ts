import type { Scene } from 'three';
import type { MapWorld } from '@neon-strike/shared/physics';
import type { PlayerController } from '@neon-strike/shared/simulation';
import { SnapshotBuffer, type PlayerCommand, type WorldSnapshot } from '@neon-strike/shared/network';
import { NetworkManager, type NetworkOptions, type NetworkReadout } from '../../network/NetworkManager';
import type { InputManager } from '../player/InputManager';
import { createRemotePlayers } from './createRemotePlayers';
import type { NetworkCombatPresentation } from './NetworkCombatPresentation';
import type { TrainingReadout } from '../combat/TrainingRuntime';

export class NetworkRuntime {
  private manager: NetworkManager;
  private buffer = new SnapshotBuffer();
  private objects;
  private latest: WorldSnapshot | null = null;
  private incoming: WorldSnapshot | null = null;
  private pending: PlayerCommand[] = [];
  private outgoing: PlayerCommand[] = [];
  private seq = 0;
  private active = false;
  private lifeId = 0;
  private lastUi = 0;
  private message = 'CONECTANDO...';
  readonly offset = { x: 0, y: 0, z: 0 };
  constructor(private physics: MapWorld, private player: PlayerController, scene: Scene, private input: InputManager,
    options: NetworkOptions, private onReadout: (readout: NetworkReadout) => void, private onLost: () => void,
    private combat: NetworkCombatPresentation, private onCombat?: (readout: TrainingReadout) => void) {
    this.objects = createRemotePlayers(scene);
    this.manager = new NetworkManager(options, {
      welcome: (welcome) => {
        this.seq = 0; this.pending.length = 0; this.outgoing.length = 0; this.buffer.clear();
        this.active = false; this.lifeId = 0; this.latest = null; this.input.clear();
        this.combat.reset();
        const local = welcome.snapshot.players.find((p) => p.id === welcome.id)!;
        this.player.restore(local.pose); this.input.yaw = local.pose.yaw; this.input.pitch = local.pitch;
        this.offset.x = 0; this.offset.y = 0; this.offset.z = 0;
        this.receive(welcome.snapshot);
      },
      snapshot: (snapshot) => this.receive(snapshot),
      state: (state, message) => {
        this.message = message;
        if (state !== 'connected') { this.active = false; this.pending.length = 0; this.outgoing.length = 0; this.input.clear(); this.onLost(); }
        this.publish();
      },
    });
    this.publish();
  }
  get connected() { return this.manager.state === 'connected'; }
  get ended() { return this.latest?.combat?.match.state === 'MATCH_END'; }
  get fighter() { return this.latest?.combat?.fighters.find((p) => p.id === this.manager.id); }
  get canMove() {
    const combat = this.latest?.combat;
    return !combat || Boolean(this.fighter?.hp && ['WAITING', 'PLAYING'].includes(combat.match.state));
  }
  private receive(snapshot: WorldSnapshot) {
    if (this.latest && snapshot.tick < this.latest.tick) return;
    this.latest = snapshot; this.incoming = snapshot; this.buffer.push(snapshot, performance.now());
    this.combat.receive(snapshot, this.manager.id);
    if (this.ended && this.input.locked) this.input.release();
  }
  private synchronize() {
    if (!this.incoming) return;
    const snapshot = this.incoming; this.incoming = null;
    const local = snapshot.players.find((p) => p.id === this.manager.id);
    if (!local) return;
    this.objects.roster(snapshot, this.manager.id);
    const fighter = snapshot.combat?.fighters.find((p) => p.id === this.manager.id);
    const newLife = Boolean(fighter && fighter.lifeId !== this.lifeId);
    if (newLife) {
      this.lifeId = fighter!.lifeId;
      // Flush the partial batch before dropping prediction; sequence numbers must stay contiguous.
      this.manager.send(this.outgoing); this.outgoing = [];
      this.pending.length = 0; this.input.clearGameplay();
      this.input.yaw = local.pose.yaw; this.input.pitch = local.pitch;
    }
    const { x, y, z } = this.player.state;
    this.player.restore(local.pose);
    this.pending = this.pending.filter((command) => command.seq > local.ack);
    // Re-simulate only commands the server has not acknowledged, against the same static colliders.
    if (this.active && this.canMove) for (const command of this.pending) {
      if (fighter && command.combat?.lifeId !== fighter.lifeId) continue;
      this.player.beforeStep(command); this.physics.world.step(); this.player.afterStep();
    }
    const correction = Math.hypot(x - this.player.state.x, y - this.player.state.y, z - this.player.state.z);
    if (this.active && this.canMove && !newLife && correction < 1) {
      this.offset.x += x - this.player.state.x; this.offset.y += y - this.player.state.y; this.offset.z += z - this.player.state.z;
      const length = Math.hypot(this.offset.x, this.offset.y, this.offset.z);
      if (length > 0.35) { this.offset.x *= 0.35 / length; this.offset.y *= 0.35 / length; this.offset.z *= 0.35 / length; }
    } else { this.offset.x = 0; this.offset.y = 0; this.offset.z = 0; }
  }
  step() {
    this.synchronize();
    if (!this.connected || !this.active || this.pending.length >= 120) return;
    if (!this.canMove) this.input.clearGameplay();
    const command: PlayerCommand = { ...this.input.read(), seq: ++this.seq, pitch: this.input.pitch,
      ...(this.fighter ? { combat: { ...this.input.readCombat(), lifeId: this.fighter.lifeId } } : {}) };
    this.pending.push(command); this.outgoing.push(command);
    if (this.canMove) { this.player.beforeStep(command); this.physics.world.step(); this.player.afterStep(); }
    if (this.outgoing.length === 2) { this.manager.send(this.outgoing); this.outgoing = []; }
  }
  setActive(active: boolean) {
    this.active = active && this.connected;
    this.combat.setActive(this.active);
    if (this.connected) {
      this.manager.send(this.outgoing); this.outgoing = [];
      this.manager.setActive(this.active);
    }
    if (!this.active) { this.pending.length = 0; this.player.clearInput(); }
  }
  update(now: number, delta: number) {
    this.manager.checkStale(now); this.synchronize(); this.objects.update(this.buffer, now, delta);
    const decay = Math.exp(-delta * 18); this.offset.x *= decay; this.offset.y *= decay; this.offset.z *= decay;
    if (now - this.lastUi >= 100) { this.lastUi = now; this.publish(); }
  }
  private publish() {
    this.onReadout({ state: this.manager.state, message: this.message, id: this.manager.id, snapshot: this.latest });
    const readout = this.latest && this.combat.readout(this.latest, this.manager.id);
    if (readout) this.onCombat?.(readout);
  }
  dispose() { this.manager.dispose(); this.combat.dispose(); this.objects.dispose(); this.buffer.clear(); this.pending.length = 0; this.outgoing.length = 0; }
}
