import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { preflight } from '../tooling/windows-preflight.js';

async function server(handler) {
  const instance = http.createServer(handler);
  await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
  return instance;
}
const port = (instance) => instance.address().port;
const close = (instance) => new Promise((resolve) => instance.close(resolve));

test('iniciador reconhece SL Campo aberto e conflito de porta sem encerrar processos', async () => {
  const free = await server((_, response) => response.end());
  const apiPort = port(free);
  await close(free);

  const running = await server((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ ok: request.url === '/api/health' }));
  });
  assert.equal(await preflight({ apiPort, webPort: port(running) }), 42);
  await close(running);

  const unrelated = await server((_, response) => response.end('outro programa'));
  const unrelatedPort = port(unrelated);
  assert.equal(await preflight({ apiPort, webPort: unrelatedPort }), 43);
  await close(unrelated);
  assert.equal(await preflight({ apiPort, webPort: unrelatedPort }), 0);
});
