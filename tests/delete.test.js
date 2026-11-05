import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import { createApp } from '../server/app.js';
async function setup(examples) {
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_PASSWORD = 'Only-for-reset-tests';
  process.env.DEMO_SEED_EXAMPLES = String(examples);
  const db = new PGlite();
  await db.exec(await fs.readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  const app = await createApp(db);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  const req = async (path, method = 'GET', body, cookie) => {
    const r = await fetch(url + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get('set-cookie')?.split(';')[0],
    };
  };
  const login = async (email) =>
    (await req('/login', 'POST', { email, password: 'Only-for-reset-tests' })).cookie;
  return {
    db,
    app,
    req,
    login,
    close: async () => {
      app.locals.closeLiveConnections();
      await new Promise((r) => server.close(r));
      await db.close();
    },
  };
}
test('instalação padrão começa sem chamados e sem técnicos', async () => {
  const f = await setup(false);
  try {
    assert.equal((await f.db.query('SELECT count(*)::int AS n FROM orders')).rows[0].n, 0);
    assert.equal(
      (await f.db.query("SELECT count(*)::int AS n FROM users WHERE role='tecnico'")).rows[0].n,
      0,
    );
    assert.deepEqual(
      (await f.db.query('SELECT role FROM users ORDER BY role')).rows.map((r) => r.role),
      ['admin', 'gestor'],
    );
  } finally {
    await f.close();
  }
});
test('administrador zera chamados e técnicos, preserva acessos e impede restauração offline', async () => {
  const f = await setup(true);
  try {
    const admin = await f.login('admin@slcampo.local'),
      tech = await f.login('tecnico@slcampo.local'),
      manager = await f.login('gestor@slcampo.local');
    assert.equal((await f.req('/orders', 'DELETE', undefined, tech)).status, 403);
    assert.equal((await f.req('/technicians', 'DELETE', undefined, manager)).status, 403);
    assert.equal((await f.req('/technicians', 'DELETE', undefined, admin)).status, 409);
    const record = (await f.req('/orders', 'GET', undefined, tech)).data[0];
    const command = {
      commandId: crypto.randomUUID(),
      baseRevision: record.revision,
      data: record.data,
    };
    assert.equal((await f.req('/sync', 'POST', command, tech)).status, 200);
    const removed = await f.req('/orders', 'DELETE', undefined, admin);
    assert.equal(removed.status, 200);
    assert.equal(removed.data.deleted, 1);
    assert.deepEqual((await f.req('/orders', 'GET', undefined, admin)).data, []);
    assert.deepEqual((await f.req('/order-deletions', 'GET', undefined, tech)).data, ['41250']);
    assert.equal((await f.req('/sync', 'POST', command, tech)).status, 410);
    assert.equal((await f.db.query('SELECT count(*)::int AS n FROM commands')).rows[0].n, 0);
    assert.equal((await f.req('/technicians', 'DELETE', undefined, admin)).data.deleted, 1);
    assert.deepEqual((await f.req('/users', 'GET', undefined, admin)).data, []);
    assert.equal((await f.req('/me', 'GET', undefined, tech)).status, 401);
    assert.equal((await f.req('/me', 'GET', undefined, admin)).status, 200);
    assert.equal((await f.req('/me', 'GET', undefined, manager)).status, 200);
    await createApp(f.db);
    assert.equal((await f.db.query('SELECT count(*)::int AS n FROM orders')).rows[0].n, 0);
    assert.equal(
      (await f.db.query("SELECT count(*)::int AS n FROM users WHERE role='tecnico'")).rows[0].n,
      0,
    );
  } finally {
    await f.close();
  }
});
