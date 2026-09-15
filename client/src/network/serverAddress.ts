export function serverAddress(value: string): string | null {
  try {
    const url = new URL(value.trim().includes('://') ? value.trim() : `http://${value.trim()}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return url.origin;
  } catch { return null; }
}
