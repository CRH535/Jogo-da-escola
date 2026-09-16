import { io, type Socket } from 'socket.io-client';
import { NET, NETWORK_VERSION, validSnapshot, validWelcome, type ClientEvents, type NetworkError, type PlayerCommand, type ServerEvents, type Welcome, type WorldSnapshot, type RoomRequest } from '@neon-strike/shared/network';

export interface NetworkOptions { address: string; name: string; room?: RoomRequest }
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'unavailable' | 'full' | 'incompatible' | 'rejected';
export interface NetworkReadout { state: ConnectionState; message: string; id: string; snapshot: WorldSnapshot | null }
interface Callbacks { welcome: (value: Welcome) => void; snapshot: (value: WorldSnapshot) => void; state: (state: ConnectionState, message: string) => void }
const errors: Record<NetworkError, string> = {
  INCOMPATIBLE: 'VERSÃO INCOMPATÍVEL', INVALID_NAME: 'NOME INVÁLIDO', FULL: 'SALA CHEIA', EXPIRED: 'SESSÃO EXPIRADA. CONECTE NOVAMENTE.',
  IN_USE: 'SESSÃO JÁ CONECTADA', RATE_LIMIT: 'CONEXÃO ENCERRADA: LIMITE DE EVENTOS', INVALID_INPUT: 'CONEXÃO ENCERRADA: DADOS INVÁLIDOS',
  NO_ROOM: 'SALA NÃO ENCONTRADA', ROOM_REQUIRED: 'INFORME O CÓDIGO DA SALA', ROOM_CLOSED: 'SALA ENCERRADA: O HOST SAIU',
  STARTED: 'PARTIDA JÁ INICIADA', NOT_HOST: 'SOMENTE O HOST PODE INICIAR', NOT_READY: 'AGUARDANDO JOGADORES PRONTOS',
  NEED_PLAYERS: 'AGUARDANDO OUTRO JOGADOR', ROOM_LIMIT: 'SERVIDOR SEM VAGAS PARA NOVAS SALAS',
};
export class NetworkManager {
  private socket: Socket<ServerEvents, ClientEvents>;
  private token = '';
  private epoch = '';
  private roomId = '';
  private disposed = false;
  private terminal = false;
  private lastSnapshot = 0;
  private resumeRetries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  id = '';
  state: ConnectionState = 'connecting';
  constructor(options: NetworkOptions, private callbacks: Callbacks) {
    this.socket = io(options.room ? `${options.address}/rooms` : options.address, {
      transports: ['websocket'], autoConnect: false, timeout: 2500, reconnectionAttempts: 4, reconnectionDelay: 500, reconnectionDelayMax: 1500,
      auth: (done) => done({ version: NETWORK_VERSION, name: options.name, ...(this.token ? { token: this.token } : {}),
        ...(options.room ? { room: this.roomId ? { action: 'join', id: this.roomId } : options.room } : {}) }),
    });
    this.socket.on('network:welcome', (value: unknown) => {
      if (!validWelcome(value)) { this.fail('INVALID_INPUT'); return; }
      this.id = value.id; this.token = value.token; this.epoch = value.epoch; this.lastSnapshot = performance.now();
      this.roomId = value.snapshot.lobby?.id ?? '';
      this.resumeRetries = 0; clearTimeout(this.retryTimer); this.retryTimer = undefined;
      this.callbacks.welcome(value); this.change('connected', 'CONECTADO');
      console.info('[NETWORK] Connected');
    });
    this.socket.on('world:state', (value: unknown) => {
      if (this.state !== 'connected') return;
      if (!validSnapshot(value)) { this.fail('INVALID_INPUT'); return; }
      this.lastSnapshot = performance.now(); this.callbacks.snapshot(value);
    });
    this.socket.on('network:probe', (ack) => { if (typeof ack === 'function') ack(); });
    this.socket.on('lobby:error', (code) => {
      if (this.state === 'connected' && Object.hasOwn(errors, code)) this.change('connected', errors[code]);
    });
    this.socket.on('network:error', (code: unknown) => this.fail(typeof code === 'string' && Object.hasOwn(errors, code) ? code as NetworkError : 'INVALID_INPUT'));
    this.socket.on('connect_error', (error) => {
      const code: unknown = (error as Error & { data?: { code?: unknown } }).data?.code;
      if (typeof code === 'string' && Object.hasOwn(errors, code)) this.fail(code as NetworkError);
    });
    this.socket.on('disconnect', (reason) => {
      this.epoch = '';
      if (!this.disposed && !this.terminal) this.change(reason === 'io server disconnect' ? 'unavailable' : 'reconnecting',
        reason === 'io server disconnect' ? 'SERVIDOR INDISPONÍVEL' : 'CONEXÃO PERDIDA. TENTANDO RECONECTAR...');
    });
    this.socket.io.on('reconnect_failed', () => {
      this.terminal = true; this.change('unavailable', this.id ? 'SERVIDOR INDISPONÍVEL' : 'SERVIDOR NÃO ENCONTRADO'); this.socket.disconnect();
    });
    this.socket.connect();
  }
  private change(state: ConnectionState, message: string) {
    if (this.disposed) return;
    this.state = state; this.callbacks.state(state, message);
  }
  private fail(code: NetworkError) {
    // A half-open transport may still own the session until the server heartbeat expires.
    if (code === 'IN_USE' && this.token && this.resumeRetries++ < 3) {
      this.change('reconnecting', 'CONEXÃO PERDIDA. TENTANDO RECONECTAR...'); this.socket.disconnect();
      this.retryTimer = setTimeout(() => { this.retryTimer = undefined; if (!this.disposed && !this.terminal) this.socket.connect(); }, 1000);
      return;
    }
    this.terminal = true;
    this.change(code === 'FULL' ? 'full' : code === 'INCOMPATIBLE' ? 'incompatible' : 'rejected', errors[code] ?? errors.INVALID_INPUT);
    this.socket.disconnect();
  }
  send(commands: PlayerCommand[]) { if (this.state === 'connected' && this.socket.connected && commands.length) this.socket.emit('player:input', { epoch: this.epoch, commands }); }
  setActive(active: boolean) { if (this.state === 'connected') this.socket.emit('player:active', { epoch: this.epoch, active }); }
  setReady(ready: boolean) {
    if (this.state !== 'connected' || !this.roomId) return;
    this.change('connected', 'CONECTADO'); this.socket.emit('lobby:ready', { epoch: this.epoch, roomId: this.roomId, ready });
  }
  lobbyAction(event: 'lobby:start' | 'lobby:return') {
    if (this.state !== 'connected' || !this.roomId) return;
    this.change('connected', 'CONECTADO'); this.socket.emit(event, { epoch: this.epoch, roomId: this.roomId });
  }
  checkStale(now: number) { if (this.state === 'connected' && now - this.lastSnapshot > NET.staleMs) this.socket.io.engine?.close(); }
  dispose() {
    this.disposed = true;
    clearTimeout(this.retryTimer); this.retryTimer = undefined;
    if (this.socket.connected) this.socket.emit('player:leave');
    this.socket.removeAllListeners(); this.socket.io.removeAllListeners(); this.socket.disconnect(); this.token = ''; this.epoch = '';
  }
}
