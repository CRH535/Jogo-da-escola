import type { Server } from 'node:http';
import { networkInterfaces } from 'node:os';

export function lanAddresses(server: Server): string[] {
  const bound = server.address();
  if (!bound || typeof bound === 'string') return [];
  if (bound.address !== '0.0.0.0' && bound.address !== '::') return [`http://${bound.address.includes(':') ? `[${bound.address}]` : bound.address}:${bound.port}`];
  const ips = [...new Set(Object.values(networkInterfaces()).flat().filter((entry) => entry?.family === 'IPv4' && !entry.internal).map((entry) => entry!.address))];
  const privateIp = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  ips.sort((a, b) => Number(privateIp(b)) - Number(privateIp(a)) || a.localeCompare(b));
  return (ips.length ? ips : ['127.0.0.1']).slice(0, 16).map((ip) => `http://${ip}:${bound.port}`);
}
