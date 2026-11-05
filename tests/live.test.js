import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import { createApp } from '../server/app.js';
const wait = async (predicate) => {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error('Evento esperado não recebido');
};
test('tempo real autenticado avisa administrador e técnicos autorizados, inclusive reatribuição', async () => {
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_SEED_EXAMPLES = 'true';
  process.env.DEMO_PASSWORD = 'Only-for-live-tests';
  const db = new PGlite();
  await db.exec(await fs.readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  const app = await createApp(db);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const streams = [];
  const login = async (email) => {
    const r = await fetch(base + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Only-for-live-tests' }),
    });
    assert.equal(r.status, 200);
    return r.headers.get('set-cookie').split(';')[0];
  };
  const request = async (path, cookie, body) => {
    const r = await fetch(base + '/api' + path, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.equal(r.status, 200);
    return r.json();
  };
  const open = async (cookie) => {
    const controller = new AbortController();
    const r = await fetch(base + '/api/events', {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /event-stream/);
    const state = { controller, text: '' };
    streams.push(state);
    const reader = r.body.getReader();
    (async () => {
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          state.text += new TextDecoder().decode(next.value);
        }
      } catch {}
    })();
    await wait(() => state.text.includes('ready'));
    return state;
  };
  try {
    assert.equal((await fetch(base + '/api/events')).status, 401);
    const hash = (await db.query("SELECT password_hash FROM users WHERE id='tec-demo'")).rows[0]
      .password_hash;
    await db.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [
      'other',
      'Outro',
      'other@test.local',
      hash,
      'tecnico',
    ]);
    const boss = await login('admin@slcampo.local'),
      tech = await login('tecnico@slcampo.local'),
      other = await login('other@test.local');
    const bs = await open(boss),
      ts = await open(tech),
      os = await open(other);
    let record = (await request('/orders', boss))[0];
    record.data.priority = 'Alta';
    record = await request('/sync', boss, {
      commandId: crypto.randomUUID(),
      baseRevision: record.revision,
      data: record.data,
    });
    await wait(() => bs.text.includes('orders-changed') && ts.text.includes('orders-changed'));
    assert.ok(!os.text.includes('orders-changed'));
    record.data.technicianId = 'other';
    await request('/sync', boss, {
      commandId: crypto.randomUUID(),
      baseRevision: record.revision,
      data: record.data,
    });
    await wait(() => os.text.includes('orders-changed'));
    assert.equal((await request('/orders', tech)).length, 0);
    assert.equal((await request('/orders', other)).length, 1);
  } finally {
    for (const s of streams) s.controller.abort();
    app.locals.closeLiveConnections();
    await new Promise((r) => server.close(r));
    await db.close();
  }
});
