import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localVersion } from '../tooling/local-version.js';
test('versão local detecta mudanças de código sem ler .env e banco', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sl-version-'));
  try {
    for (const name of ['src', 'server', 'public', 'tooling', '.data'])
      await mkdir(path.join(dir, name));
    for (const file of [
      'index.html',
      'package.json',
      'package-lock.json',
      'vite.config.ts',
      'src/app.ts',
    ])
      await writeFile(path.join(dir, file), 'inicial');
    const first = await localVersion(dir);
    await writeFile(path.join(dir, '.env'), 'segredo-de-teste');
    await writeFile(path.join(dir, '.data', 'db'), 'dados-de-teste');
    assert.equal(await localVersion(dir), first);
    await writeFile(path.join(dir, 'src/app.ts'), 'nova versão');
    assert.notEqual(await localVersion(dir), first);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
