import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readServerConfig } from './config/environment.js';
import { createApp } from './http/app.js';
import { createMovementNetwork } from './network/createMovementNetwork.js';

const environmentFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const config = readServerConfig(process.env);
const clientDirectory = fileURLToPath(new URL('../../client/dist/', import.meta.url));
const server = createServer(createApp({ clientDirectory }));
const network = await createMovementNetwork(server);

server.on('error', (error: NodeJS.ErrnoException) => {
  const message = error.code === 'EADDRINUSE'
    ? `Port ${config.port} is already in use. Set SERVER_PORT and restart.`
    : error.message;
  console.error(`[SERVER] ${message}`);
  process.exitCode = 1;
  void network.close();
});

server.listen(config.port, config.host, () => {
  console.info(`[SERVER] Listening on ${config.host}:${config.port}`);
  console.info(`[SERVER] Health: http://localhost:${config.port}/api/health`);
  if (config.host === '0.0.0.0') {
    const addresses = new Set(Object.values(networkInterfaces()).flat()
      .filter((entry) => entry?.family === 'IPv4' && !entry.internal)
      .map((entry) => entry!.address));
    for (const address of addresses) console.info(`[SERVER] LAN: http://${address}:${config.port}`);
  }
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  console.info('[SERVER] Shutting down');
  void network.close().then(() => {
    clearTimeout(timeout);
  }).catch((error: unknown) => {
    clearTimeout(timeout); console.error('[SERVER] Shutdown failed', error); process.exitCode = 1;
  });
  const timeout = setTimeout(() => {
    server.closeAllConnections();
    process.exitCode = 1;
  }, 5000);
  timeout.unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
