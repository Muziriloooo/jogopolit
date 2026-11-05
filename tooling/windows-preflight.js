import net from 'node:net';
import { pathToFileURL } from 'node:url';

const host = '127.0.0.1';
export function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(700);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

export async function slCampoRunning(webPort = 5173) {
  try {
    const response = await fetch(`http://127.0.0.1:${webPort}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok && (await response.json()).ok === true;
  } catch {
    return false;
  }
}

export async function preflight({ apiPort = 3001, webPort = 5173 } = {}) {
  if (await slCampoRunning(webPort)) {
    console.log('O SL Campo ja esta em execucao. Abrindo o navegador...');
    return 42;
  }

  const occupied = [];
  for (const port of [apiPort, webPort]) if (await portOpen(port)) occupied.push(port);
  if (occupied.length) {
    console.error(`As portas ${occupied.join(' e ')} ja estao em uso por outro programa.`);
    return 43;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await preflight();
