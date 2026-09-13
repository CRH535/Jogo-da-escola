export interface HealthResponse {
  status: 'ok';
  service: 'neon-strike-server';
  version: string;
  protocolVersion: number;
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  return data.status === 'ok'
    && data.service === 'neon-strike-server'
    && typeof data.version === 'string'
    && Number.isSafeInteger(data.protocolVersion);
}
