import { fileURLToPath } from 'node:url';
const path = fileURLToPath(new URL('./network.html', import.meta.url)).replaceAll('\\', '/');
export const networkUrl = (route = 'multiplayer') => `/@fs/${path}#${route}`;
