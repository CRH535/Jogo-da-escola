import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createMapWorld } from '@neon-strike/shared/physics';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import { FixedStep } from '@neon-strike/shared/simulation';
import type { MatchRules } from '@neon-strike/shared/match';
import { NETWORK_VERSION, validInput, validName, type ClientEvents, type NetworkError, type ServerEvents } from '@neon-strike/shared/network';
import { CombatArena } from '../game/CombatArena.js';
import { RateLimit } from './RateLimit.js';

export async function createMovementNetwork(http: HttpServer, rules?: Readonly<MatchRules>) {
  const arena = new CombatArena(await createMapWorld(NEON_FACILITY), rules);
  const io = new Server<ClientEvents, ServerEvents>(http, {
    transports: ['websocket'], maxHttpBufferSize: 8192, pingInterval: 1000, pingTimeout: 2000, connectTimeout: 4000,
    perMessageDeflate: false, serveClient: false,
  });
  const handshakes = new Map<string, RateLimit>();
  io.use((socket, next) => {
    const ip = socket.handshake.address;
    if (!handshakes.has(ip)) {
      if (handshakes.size >= 64) handshakes.delete(handshakes.keys().next().value!);
      handshakes.set(ip, new RateLimit(2, 16));
    }
    const auth = socket.handshake.auth;
    const error: NetworkError | null = !handshakes.get(ip)!.take() ? 'RATE_LIMIT' : auth.version !== NETWORK_VERSION ? 'INCOMPATIBLE' :
      !validName(auth.name) ? 'INVALID_NAME' : auth.token !== undefined && (typeof auth.token !== 'string' || !/^[\w-]{43}$/.test(auth.token)) ? 'EXPIRED' : null;
    next(error ? Object.assign(new Error(error), { data: { code: error } }) : undefined);
  });
  io.on('connection', (socket) => {
    const joined = arena.join(socket.handshake.auth.name as string, socket.handshake.auth.token as string | undefined);
    if (typeof joined === 'string') { socket.emit('network:error', joined); socket.disconnect(true); return; }
    const player = joined; const epoch = player.epoch;
    socket.data.playerId = player.id;
    const rate = new RateLimit(40, 20);
    let removed = false;
    const reject = (code: NetworkError) => { socket.emit('network:error', code); removed = true; arena.remove(player); socket.disconnect(true); };
    socket.onAny((event: string) => {
      if (!rate.take()) reject('RATE_LIMIT');
      else if (!['player:input', 'player:active', 'player:leave'].includes(event)) reject('INVALID_INPUT');
    });
    socket.on('player:input', (packet: unknown) => {
      if (removed || player.epoch !== epoch) return;
      if (!validInput(packet) || !arena.input(player, packet)) reject('INVALID_INPUT');
    });
    socket.on('player:active', (packet) => {
      if (removed || player.epoch !== epoch) return;
      if (!packet || Object.keys(packet).sort().join(',') !== 'active,epoch' || packet.epoch !== epoch || typeof packet.active !== 'boolean') { reject('INVALID_INPUT'); return; }
      arena.setActive(player, packet.active);
    });
    socket.on('player:leave', () => { if (!removed) { removed = true; arena.remove(player); socket.disconnect(true); } });
    socket.on('disconnect', (reason) => {
      if (!removed && player.epoch === epoch) arena.disconnect(player, performance.now(), reason === 'client namespace disconnect' || reason === 'server namespace disconnect');
      console.info(`[NETWORK] Player disconnected: ${player.id}`);
    });
    socket.emit('network:welcome', { id: player.id, token: player.token, epoch, snapshot: arena.snapshot() });
    console.info(`[NETWORK] Player joined: ${player.id}`);
  });
  let closed = false; let last = performance.now();
  const clock = new FixedStep();
  function loop() {
    if (closed) return;
    const now = performance.now();
    clock.advance((now - last) / 1000, () => {
      arena.step(now);
      if (arena.tick % 3 === 0 && arena.players.size) io.volatile.emit('world:state', arena.snapshot());
      if (arena.tick % 60 === 0) for (const socket of io.sockets.sockets.values()) {
        const player = arena.players.get(socket.data.playerId as string);
        if (!player) continue;
        const started = performance.now();
        socket.timeout(1500).emit('network:probe', (error: Error | null) => { player.pingMs = error ? null : Math.min(10000, Math.round(performance.now() - started)); });
      }
    });
    last = now; timer = setTimeout(loop, 8); timer.unref();
  }
  let timer = setTimeout(loop, 8); timer.unref();
  return {
    arena,
    async close() {
      if (closed) return;
      closed = true; clearTimeout(timer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
      arena.dispose(); handshakes.clear();
    },
  };
}
