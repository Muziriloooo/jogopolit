import { createServer } from 'vite';

const apiTarget = process.env.SL_API_TARGET || 'http://127.0.0.1:3001';
const healthUrl = new URL('/api/health', apiTarget).toString();
const deadline = Date.now() + 120000;

console.log('Aguardando a API e o banco de dados ficarem prontos...');
while (true) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2500) });
    if (response.ok && (await response.json()).ok === true) break;
  } catch {}
  if (Date.now() >= deadline)
    throw new Error('A API nao ficou pronta em 2 minutos. Confira as mensagens do servidor.');
  await new Promise((resolve) => setTimeout(resolve, 500));
}

console.log('API pronta. Iniciando a interface...');
const client = await createServer();
await client.listen();
client.printUrls();

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await client.close();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
