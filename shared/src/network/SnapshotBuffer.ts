import type { WorldSnapshot } from './protocol.js';

export interface RemotePose { x: number; y: number; z: number; yaw: number; pitch: number; speed: number }
export class SnapshotBuffer {
  private frames: { snapshot: WorldSnapshot; received: number }[] = [];
  get size() { return this.frames.length; }
  clear() { this.frames.length = 0; }
  push(snapshot: WorldSnapshot, received: number) {
    if (this.frames.length && snapshot.tick <= this.frames[this.frames.length - 1]!.snapshot.tick) return;
    this.frames.push({ snapshot, received });
    if (this.frames.length > 32) this.frames.shift();
  }
  sample(id: string, now: number, out: RemotePose) {
    const latest = this.frames[this.frames.length - 1];
    if (!latest) return false;
    const target = Math.min(latest.snapshot.tick + 2, latest.snapshot.tick - 6 + Math.max(0, now - latest.received) * 0.06);
    let before = this.frames[0]!; let after = latest;
    for (const frame of this.frames) { if (frame.snapshot.tick <= target) before = frame; else { after = frame; break; } }
    const a = before.snapshot.players.find((p) => p.id === id) ?? after.snapshot.players.find((p) => p.id === id);
    const b = after.snapshot.players.find((p) => p.id === id) ?? a;
    if (!a || !b) return false;
    const latestLife = latest.snapshot.combat?.fighters.find((p) => p.id === id)?.lifeId;
    if (latestLife !== before.snapshot.combat?.fighters.find((p) => p.id === id)?.lifeId) {
      const current = latest.snapshot.players.find((p) => p.id === id);
      if (!current) return false;
      Object.assign(out, { x: current.pose.x, y: current.pose.y, z: current.pose.z, yaw: current.pose.yaw, pitch: current.pitch, speed: 0 });
      return true;
    }
    const range = after.snapshot.tick - before.snapshot.tick;
    const lifeBefore = before.snapshot.combat?.fighters.find((p) => p.id === id)?.lifeId;
    const lifeAfter = after.snapshot.combat?.fighters.find((p) => p.id === id)?.lifeId;
    const alpha = lifeBefore !== lifeAfter ? 1 : range > 0 ? Math.max(0, Math.min(1, (target - before.snapshot.tick) / range)) : 0;
    out.x = a.pose.x + (b.pose.x - a.pose.x) * alpha;
    out.y = a.pose.y + (b.pose.y - a.pose.y) * alpha;
    out.z = a.pose.z + (b.pose.z - a.pose.z) * alpha;
    const angle = Math.atan2(Math.sin(b.pose.yaw - a.pose.yaw), Math.cos(b.pose.yaw - a.pose.yaw));
    out.yaw = a.pose.yaw + angle * alpha; out.pitch = a.pitch + (b.pitch - a.pitch) * alpha;
    out.speed = Math.hypot(b.pose.vx, b.pose.vz);
    if (target > latest.snapshot.tick) {
      const extra = (target - latest.snapshot.tick) / 60;
      out.x += b.pose.vx * extra; out.z += b.pose.vz * extra;
    }
    return true;
  }
}
