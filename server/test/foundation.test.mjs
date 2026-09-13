import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createApp } from '../dist/http/app.js';
import { readServerConfig } from '../dist/config/environment.js';
import { isHealthResponse, APP_VERSION, PROTOCOL_VERSION } from '@neon-strike/shared';

async function startApp(t, options) {
  const server = createServer(createApp(options));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('HTTP health exposes the shared version and prevents stale health caching', async (t) => {
  const base = await startApp(t);
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-powered-by'), null);
  const body = await response.json();
  assert.ok(isHealthResponse(body));
  assert.equal(body.version, APP_VERSION);
  assert.equal(body.protocolVersion, PROTOCOL_VERSION);
});

test('unknown API paths and unsupported health methods return 404', async (t) => {
  const base = await startApp(t);
  for (const [route, method] of [['/api/missing', 'GET'], ['/api/health', 'POST'], ['/missing', 'GET']]) {
    const response = await fetch(`${base}${route}`, { method });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'NOT_FOUND' });
  }
});

test('server runs independently before a client build exists', async (t) => {
  const base = await startApp(t, { clientDirectory: path.join(tmpdir(), 'neon-nonexistent-build') });
  const response = await fetch(base);
  assert.deepEqual(await response.json(), { service: 'neon-strike-server', health: '/api/health' });
});

test('built client and API coexist on the backend port', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'neon-strike-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'index.html'), '<h1>NEON STRIKE</h1>');
  const base = await startApp(t, { clientDirectory: directory });
  assert.equal(await (await fetch(base)).text(), '<h1>NEON STRIKE</h1>');
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);
});

test('configuration accepts explicit ports and rejects invalid values', () => {
  assert.deepEqual(readServerConfig({}), { host: '0.0.0.0', port: 3000 });
  assert.deepEqual(readServerConfig({ SERVER_HOST: '127.0.0.1', SERVER_PORT: '3100' }), { host: '127.0.0.1', port: 3100 });
  for (const port of ['', '0', '-1', '65536', '3000abc', '3000.5', 'Infinity', '1e3']) {
    assert.throws(() => readServerConfig({ SERVER_PORT: port }), /SERVER_PORT/);
  }
  assert.throws(() => readServerConfig({ SERVER_HOST: ' ' }), /SERVER_HOST/);
});

test('health contract rejects malformed responses before they reach the UI', () => {
  for (const value of [null, [], {}, 'ok', { status: 'ok', service: 'another-server' },
    { status: 'ok', service: 'neon-strike-server', version: '0.1.0', protocolVersion: '1' }]) {
    assert.equal(isHealthResponse(value), false);
  }
});
