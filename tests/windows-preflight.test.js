import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
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

test('atualizador aceita ZIP e preserva configuração, banco e runtime', async () => {
  const root = new URL('../', import.meta.url);
  const [batch, bootstrap, powershell] = await Promise.all([
    fs.readFile(new URL('atualizar.bat', root), 'utf8'),
    fs.readFile(new URL('atualizar-zip.bat', root), 'utf8'),
    fs.readFile(new URL('tooling/update-windows.ps1', root), 'utf8'),
  ]);
  assert.match(batch, /:atualizar_zip/);
  assert.match(batch, /update-windows\.ps1/);
  assert.doesNotMatch(batch, /exige uma copia clonada com Git/);
  assert.match(bootstrap, /raw\.githubusercontent\.com\/Muziriloooo\/jogopolit\/main/);
  assert.match(powershell, /jogopolit\/archive\/refs\/heads\/main\.zip/);
  for (const protectedPath of ["'.env'", "'.data'", "'.runtime'", "'node_modules'"])
    assert.ok(powershell.includes(protectedPath), `${protectedPath} precisa ser preservado`);
});
