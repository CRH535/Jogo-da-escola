import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environmentDirectory = fileURLToPath(new URL('../', import.meta.url));
  const env = { ...loadEnv(mode, environmentDirectory, ''), ...process.env };
  const port = Number(env.CLIENT_PORT ?? 5173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('CLIENT_PORT must be an integer between 1 and 65535.');
  }
  const proxyTarget = env.API_PROXY_TARGET ?? `http://127.0.0.1:${env.SERVER_PORT ?? 3000}`;
  const target = new URL(proxyTarget);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Invalid API_PROXY_TARGET.');
  return {
    plugins: [react()],
    envDir: environmentDirectory,
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      proxy: { '/api': { target: target.origin, changeOrigin: true } },
    },
  };
});
