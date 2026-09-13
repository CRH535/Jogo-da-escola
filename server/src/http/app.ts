import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { APP_VERSION, PROTOCOL_VERSION, type HealthResponse } from '@neon-strike/shared';

interface AppOptions {
  clientDirectory?: string;
}

export function createApp({ clientDirectory }: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_request, response) => {
    const health: HealthResponse = {
      status: 'ok',
      service: 'neon-strike-server',
      version: APP_VERSION,
      protocolVersion: PROTOCOL_VERSION,
    };
    response.set('Cache-Control', 'no-store').json(health);
  });

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'NOT_FOUND' });
  });

  if (clientDirectory && existsSync(path.join(clientDirectory, 'index.html'))) {
    app.use(express.static(clientDirectory));
  } else {
    app.get('/', (_request, response) => {
      response.json({ service: 'neon-strike-server', health: '/api/health' });
    });
  }

  app.use((_request, response) => {
    response.status(404).json({ error: 'NOT_FOUND' });
  });
  return app;
}
