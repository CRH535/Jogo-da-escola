export interface ServerConfig {
  host: string;
  port: number;
}

export function readServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const rawPort = env.SERVER_PORT ?? '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('SERVER_PORT must be an integer between 1 and 65535.');
  }
  const host = (env.SERVER_HOST ?? '0.0.0.0').trim();
  if (!host) throw new Error('SERVER_HOST must not be empty.');
  return { host, port };
}
