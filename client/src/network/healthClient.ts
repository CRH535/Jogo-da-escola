import { isHealthResponse, PROTOCOL_VERSION } from '@neon-strike/shared';

export type ServerStatus = 'connecting' | 'online' | 'unavailable' | 'incompatible';

export async function checkServer(signal: AbortSignal): Promise<ServerStatus> {
  try {
    const response = await fetch('/api/health', {
      signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
      cache: 'no-store',
    });
    if (!response.ok) return 'unavailable';
    const data: unknown = await response.json();
    if (!isHealthResponse(data)) return 'unavailable';
    return data.protocolVersion === PROTOCOL_VERSION ? 'online' : 'incompatible';
  } catch {
    return 'unavailable';
  }
}
