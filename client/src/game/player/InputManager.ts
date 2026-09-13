import type { MovementInput } from '@neon-strike/shared/simulation';

export interface InputCallbacks { onLock: (locked: boolean) => void; onError: (message: string) => void }
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'Tab']);

export class InputManager {
  yaw = 0;
  pitch = 0;
  sensitivity = 1;
  private keys = new Set<string>();
  private jumpQueued = false;
  private pending = false;
  private disposed = false;
  private allowed = true;
  private input: MovementInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
  constructor(private element: HTMLElement, private callbacks: InputCallbacks) {
    document.addEventListener('pointerlockchange', this.lockChanged);
    document.addEventListener('pointerlockerror', this.lockError);
    document.addEventListener('mousemove', this.mouseMoved);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.release);
    document.addEventListener('visibilitychange', this.visibilityChanged);
  }
  get locked() { return document.pointerLockElement === this.element; }
  request = () => {
    if (this.disposed || this.pending || this.locked) return;
    if (!this.element.requestPointerLock) { this.callbacks.onError('Pointer Lock indisponível. Use um navegador desktop compatível.'); return; }
    this.allowed = true;
    this.pending = true;
    try {
      void Promise.resolve(this.element.requestPointerLock()).then(() => {
        if ((this.disposed || !this.allowed) && this.locked) document.exitPointerLock();
      }).catch(this.lockError);
    }
    catch { this.lockError(); }
  };
  release = () => {
    this.allowed = false;
    this.clear();
    if (this.locked) document.exitPointerLock();
    if (!this.disposed) this.callbacks.onLock(false);
  };
  clear() { this.keys.clear(); this.jumpQueued = false; }
  read(): MovementInput {
    this.input.forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    this.input.right = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    this.input.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.input.jump = this.keys.has('Space') || this.jumpQueued;
    this.input.yaw = this.yaw;
    this.jumpQueued = false;
    return this.input;
  }
  private lockChanged = () => {
    this.pending = false;
    if (this.locked && (!this.allowed || this.disposed || document.hidden)) { document.exitPointerLock(); return; }
    this.clear();
    if (!this.disposed) this.callbacks.onLock(this.locked);
  };
  private lockError = () => {
    this.pending = false;
    if (!this.disposed) this.callbacks.onError('Não foi possível capturar o mouse. Clique novamente para tentar.');
  };
  private visibilityChanged = () => { if (document.hidden) this.release(); };
  private keyDown = (event: KeyboardEvent) => {
    if (!this.locked) return;
    if (event.code === 'Escape') { event.preventDefault(); this.release(); return; }
    if (!movementKeys.has(event.code)) return;
    event.preventDefault();
    if (event.code === 'Space' && !event.repeat && !this.keys.has(event.code)) this.jumpQueued = true;
    this.keys.add(event.code);
  };
  private keyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private mouseMoved = (event: MouseEvent) => {
    if (!this.locked || !Number.isFinite(event.movementX) || !Number.isFinite(event.movementY)) return;
    const scale = 0.002 * this.sensitivity;
    this.yaw = Math.atan2(Math.sin(this.yaw - event.movementX * scale), Math.cos(this.yaw - event.movementX * scale));
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch - event.movementY * scale));
  };
  dispose() {
    this.disposed = true;
    this.release();
    document.removeEventListener('pointerlockchange', this.lockChanged);
    document.removeEventListener('pointerlockerror', this.lockError);
    document.removeEventListener('mousemove', this.mouseMoved);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.release);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
  }
}
