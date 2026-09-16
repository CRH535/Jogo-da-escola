import type { Server as HttpServer } from 'node:http';
import type { Server } from 'socket.io';
import { NETWORK_VERSION, validInput, validName, validRoomRequest, type ClientEvents, type NetworkError, type ServerEvents, type LobbyCommand, type LobbyError } from '@neon-strike/shared/network';
import type { MatchRules } from '@neon-strike/shared/match';
import { RoomRegistry, type Room } from '../rooms/RoomRegistry.js';
import type { Participant } from './MovementArena.js';
import { RateLimit } from './RateLimit.js';
import { lanAddresses } from './lanAddresses.js';

export function createRoomNetwork(io: Server<ClientEvents, ServerEvents>, http: HttpServer, rules?: Readonly<MatchRules>) {
  const namespace = io.of('/rooms');
  const registry = new RoomRegistry(() => lanAddresses(http), (id) => {
    namespace.to(id).emit('network:error', 'ROOM_CLOSED'); namespace.in(id).disconnectSockets(true);
    console.info(`[LOBBY] Room closed: ${id}`);
  }, rules);
  const handshakes = new Map<string, RateLimit>();
  namespace.use((socket, next) => {
    const ip = socket.handshake.address;
    if (!handshakes.has(ip)) {
      if (handshakes.size >= 64) handshakes.delete(handshakes.keys().next().value!);
      handshakes.set(ip, new RateLimit(2, 16));
    }
    const auth = socket.handshake.auth;
    const error: NetworkError | null = !handshakes.get(ip)!.take() ? 'RATE_LIMIT' : auth.version !== NETWORK_VERSION ? 'INCOMPATIBLE' :
      !validName(auth.name) ? 'INVALID_NAME' : !validRoomRequest(auth.room) ? 'INVALID_INPUT' :
      auth.token !== undefined && (typeof auth.token !== 'string' || !/^[\w-]{43}$/.test(auth.token) || auth.room.action !== 'join' || !auth.room.id) ? 'EXPIRED' : null;
    next(error ? Object.assign(new Error(error), { data: { code: error } }) : undefined);
  });
  namespace.on('connection', (socket) => {
    void attach().catch((error: unknown) => {
      console.error('[LOBBY] Connection initialization failed', error);
      socket.emit('network:error', 'ROOM_CLOSED'); socket.disconnect(true);
    });
    async function attach() {
      const request: unknown = socket.handshake.auth.room;
      if (!validRoomRequest(request)) { socket.disconnect(true); return; }
      const found = request.action === 'create' ? await registry.create(request.settings) : registry.find(request.id);
      if (typeof found === 'string') { socket.emit('network:error', found); socket.disconnect(true); return; }
      const room: Room = found;
      if (!socket.connected) { if (request.action === 'create') registry.close(room.id); return; }
      const joined = room.enter(socket.handshake.auth.name as string, socket.handshake.auth.token as string | undefined);
      if (typeof joined === 'string') { socket.emit('network:error', joined); socket.disconnect(true); return; }
      const player: Participant = joined; const epoch = player.epoch;
      socket.data.roomId = room.id; socket.data.playerId = player.id;
      void socket.join(room.id);
      let removed = false;
      const rate = new RateLimit(40, 20);
      const reject = (error: NetworkError) => {
        if (removed || room.closed) return;
        removed = true; socket.emit('network:error', error); room.disconnect(player, true); socket.disconnect(true);
      };
      const valid = (packet: LobbyCommand, keys: string) => packet && Object.keys(packet).sort().join(',') === keys && packet.epoch === epoch && packet.roomId === room.id;
      const available = () => !removed && !room.closed && player.connected && player.epoch === epoch;
      const broadcast = () => { if (!room.closed) namespace.to(room.id).emit('world:state', room.snapshot()); };
      const action = (packet: LobbyCommand, keys: string, perform: () => LobbyError | null) => {
        if (!available()) return;
        if (!valid(packet, keys)) { reject('INVALID_INPUT'); return; }
        const error = perform(); if (error) socket.emit('lobby:error', error); else broadcast();
      };
      socket.onAny((event: string) => {
        if (!rate.take()) reject('RATE_LIMIT');
        else if (!['player:input', 'player:active', 'player:leave', 'lobby:ready', 'lobby:start', 'lobby:return'].includes(event)) reject('INVALID_INPUT');
      });
      socket.on('player:input', (packet: unknown) => {
        if (available() && (!validInput(packet) || !room.arena.input(player, packet))) reject('INVALID_INPUT');
      });
      socket.on('player:active', (packet) => {
        if (!available()) return;
        if (!packet || Object.keys(packet).sort().join(',') !== 'active,epoch' || packet.epoch !== epoch || typeof packet.active !== 'boolean') { reject('INVALID_INPUT'); return; }
        room.arena.setActive(player, packet.active && room.arena.match !== null && !room.arena.match.ended);
      });
      socket.on('lobby:ready', (packet) => {
        if (!packet || typeof packet.ready !== 'boolean') { reject('INVALID_INPUT'); return; }
        action(packet, 'epoch,ready,roomId', () => room.setReady(player, packet.ready));
      });
      socket.on('lobby:start', (packet) => action(packet, 'epoch,roomId', () => room.start(player)));
      socket.on('lobby:return', (packet) => action(packet, 'epoch,roomId', () => room.back()));
      socket.on('player:leave', () => {
        if (!available()) return;
        removed = true; room.disconnect(player, true); socket.disconnect(true); broadcast();
      });
      socket.on('disconnect', (reason) => {
        if (available()) { removed = true; room.disconnect(player, reason === 'client namespace disconnect' || reason === 'server namespace disconnect'); broadcast(); }
      });
      socket.emit('network:welcome', { id: player.id, token: player.token, epoch, snapshot: room.snapshot() });
      broadcast(); console.info(`[LOBBY] Player joined room: ${room.id}`);
    }
  });
  return {
    registry,
    step(now: number) { registry.step(now); },
    broadcast() { for (const room of registry.rooms.values()) namespace.to(room.id).volatile.emit('world:state', room.snapshot()); },
    probe() {
      for (const socket of namespace.sockets.values()) {
        const player = registry.rooms.get(socket.data.roomId as string)?.arena.players.get(socket.data.playerId as string);
        if (!player) continue;
        const started = performance.now();
        socket.timeout(1500).emit('network:probe', (error: Error | null) => { player.pingMs = error ? null : Math.min(10000, Math.round(performance.now() - started)); });
      }
    },
    dispose() { registry.dispose(); handshakes.clear(); },
  };
}
