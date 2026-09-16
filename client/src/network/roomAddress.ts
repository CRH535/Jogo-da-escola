import { validRoomId } from '@neon-strike/shared/network';
import { serverAddress } from './serverAddress';

export function roomAddress(value: string, code: string): { address: string; id: string } | null {
  try {
    const url = new URL(value.trim().includes('://') ? value.trim() : `http://${value.trim()}`);
    if ([...url.searchParams.keys()].some((key) => key !== 'room') || url.searchParams.getAll('room').length > 1) return null;
    const linked = url.searchParams.get('room')?.toUpperCase() ?? '';
    const id = code.trim().toUpperCase() || linked;
    if (linked && id !== linked || id && !validRoomId(id)) return null;
    url.search = '';
    const address = serverAddress(url.toString());
    return address ? { address, id } : null;
  } catch { return null; }
}
