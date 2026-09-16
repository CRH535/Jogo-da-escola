import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validRoomRequest, validRoomSettings, validLobby } from '../dist/network/protocol.js';

const settings = { name: 'Sala', map: 'neon-facility', mode: 'ffa', maxPlayers: 8, requireReady: true };
test('lobby contracts bound settings, room IDs, names and allowed modes', () => {
  assert.ok(validRoomSettings(settings)); assert.ok(validRoomRequest({ action: 'join', id: '' }));
  assert.ok(validRoomRequest({ action: 'join', id: 'ABCDEF12' }));
  assert.ok(validRoomRequest({ action: 'create', settings }));
  for (const change of [{ maxPlayers: 1 }, { maxPlayers: 9 }, { maxPlayers: 2.5 }, { requireReady: 1 }, { mode: 'tdm' }, { map: 'other' }, { name: 'a\u0000' }, { name: 'x'.repeat(21) }, { admin: true }]) {
    assert.equal(validRoomSettings({ ...settings, ...change }), false);
  }
  for (const v of [null, { action: 'join', id: '../x' }, { action: 'join', id: '12345678', host: true }, { action: 'delete', id: '' }]) assert.equal(validRoomRequest(v), false);
});
test('lobby snapshots require a present host, unique members and bounded addresses', () => {
  const id = 'a'.repeat(36);
  const snapshot = { id: 'ABCDEF12', settings, hostId: id, phase: 'LOBBY', addresses: ['http://127.0.0.1:3000'], players: [{ id, name: 'Chris', connected: true, ready: false, pingMs: 12 }] };
  assert.ok(validLobby(snapshot));
  for (const change of [{ hostId: 'b'.repeat(36) }, { phase: 'ADMIN' }, { players: [] }, { players: [...snapshot.players, ...snapshot.players] }, { addresses: Array(17).fill('http://local') }, { addresses: ['javascript:alert(1)'] }]) assert.equal(validLobby({ ...snapshot, ...change }), false);
});
