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
      ['admin'],
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
      restricted = tech;
    assert.equal((await f.req('/orders', 'DELETE', undefined, tech)).status, 403);
    assert.equal((await f.req('/technicians', 'DELETE', undefined, restricted)).status, 403);
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
    assert.ok((await f.req('/order-deletions', 'GET', undefined, tech)).data.includes('41250'));
    assert.equal((await f.req('/sync', 'POST', command, tech)).status, 410);
    assert.equal((await f.db.query('SELECT count(*)::int AS n FROM commands')).rows[0].n, 0);
    assert.equal((await f.req('/technicians', 'DELETE', undefined, admin)).data.deleted, 1);
    assert.deepEqual((await f.req('/users', 'GET', undefined, admin)).data, []);
    assert.equal((await f.req('/me', 'GET', undefined, tech)).status, 401);
    assert.equal((await f.req('/me', 'GET', undefined, admin)).status, 200);
    assert.equal((await f.req('/me', 'GET', undefined, restricted)).status, 401);
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
test('OS preenchida antes do primeiro envio sincroniza e exclusão individual não apaga outras OS', async () => {
  const f = await setup(true);
  try {
    const admin = await f.login('admin@slcampo.local'),
      tech = await f.login('tecnico@slcampo.local');
    const existing = (await f.req('/orders', 'GET', undefined, admin)).data[0].data;
    const data = structuredClone(existing);
    data.id = '5544';
    data.status = 'Em andamento';
    delete data.visits[0].checkOut;
    delete data.visits[0].voltage;
    delete data.visits[0].battery;
    const command = { commandId: crypto.randomUUID(), baseRevision: 0, data };
    const created = await f.req('/sync', 'POST', command, admin);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    assert.equal(created.data.data.visits.length, 1);
    assert.equal(created.data.data.parts.length, data.parts.length);
    assert.equal((await f.req('/orders/5544', 'DELETE', undefined, tech)).status, 403);
    assert.equal((await f.req('/orders/5544', 'DELETE', undefined, admin)).data.deleted, 1);
    assert.equal((await f.req('/sync', 'POST', command, admin)).status, 410);
    assert.deepEqual(
      (await f.req('/orders', 'GET', undefined, admin)).data.map((r) => r.data.id),
      ['41250'],
    );
    assert.equal((await f.req('/orders/LOCAL-DRAFT', 'DELETE', undefined, admin)).data.deleted, 1);
    assert.ok(
      (await f.req('/order-deletions', 'GET', undefined, admin)).data.includes('LOCAL-DRAFT'),
    );
    assert.equal(
      (
        await f.req(
          '/users',
          'POST',
          {
            name: 'Outro admin',
            email: 'another@test.local',
            password: 'Another-password-123',
            role: 'admin',
          },
          admin,
        )
      ).status,
      400,
    );
  } finally {
    await f.close();
  }
});
test('exclusão individual e em lote aceitam chaves legadas e não dependem do JSON interno', async () => {
  const f = await setup(true);
  try {
    const admin = await f.login('admin@slcampo.local'),
      tech = await f.login('tecnico@slcampo.local');
    const source = (await f.req('/orders', 'GET', undefined, admin)).data[0].data;
    const id = 'OS 5544/2026_legacy.svg';
    await f.db.query('INSERT INTO orders(id,technician_id,data) VALUES($1,$2,$3)', [
      id,
      'tec-demo',
      JSON.stringify({ ...source, id: 5544 }),
    ]);
    const rows = (await f.req('/orders', 'GET', undefined, admin)).data;
    assert.ok(rows.some((r) => r.data.id === id));
    assert.equal((await f.req('/order-deletions', 'POST', { id }, tech)).status, 403);
    const one = await f.req('/order-deletions', 'POST', { id }, admin);
    assert.equal(one.status, 200);
    assert.deepEqual(one.data.ids, [id]);
    assert.ok(
      (await f.req('/orders', 'GET', undefined, admin)).data.some((r) => r.data.id === '41250'),
    );
    const numeric = await f.req('/order-deletions', 'POST', { id: 5544 }, admin);
    assert.equal(numeric.status, 200);
    assert.deepEqual(numeric.data.ids, ['5544']);
    const malformed = await f.req('/orders', 'DELETE', { ids: [{}] }, admin);
    assert.equal(malformed.status, 400);
    assert.equal((await f.req('/orders', 'GET', undefined, admin)).data.length, 1);
    const all = await f.req('/orders', 'DELETE', { ids: [777, 'Rascunho 99/2026'] }, admin);
    assert.equal(all.status, 200);
    assert.ok(all.data.ids.includes('777'));
    assert.ok(all.data.ids.includes('Rascunho 99/2026'));
    assert.deepEqual((await f.req('/orders', 'GET', undefined, admin)).data, []);
  } finally {
    await f.close();
  }
});
test('limpeza solicitada exclui somente 44918 e é executada uma única vez', async () => {
  const { applyRequestedMaintenance } = await import('../server/maintenance.js');
  const f = await setup(true);
  try {
    // Reproduce an installation that has not received this requested cleanup yet.
    await f.db.query('DELETE FROM applied_maintenance WHERE id=$1', [
      'requested-delete-order-44918-v1',
    ]);
    await f.db.query('DELETE FROM order_deletions WHERE id=$1', ['44918']);
    const data = (await f.db.query("SELECT data FROM orders WHERE id='41250'")).rows[0].data;
    await f.db.query('INSERT INTO orders(id,technician_id,data) VALUES($1,$2,$3)', [
      '44918',
      'tec-demo',
      JSON.stringify({ ...data, id: '44918' }),
    ]);
    await f.db.query('INSERT INTO commands VALUES($1,$2,$3,$4)', [
      crypto.randomUUID(),
      'adm-demo',
      '44918',
      JSON.stringify({ data }),
    ]);
    await applyRequestedMaintenance(f.db);
    assert.deepEqual(
      (await f.db.query('SELECT id FROM orders ORDER BY id')).rows.map((r) => r.id),
      ['41250'],
    );
    assert.equal(
      (await f.db.query("SELECT count(*)::int AS n FROM commands WHERE order_id='44918'")).rows[0]
        .n,
      0,
    );
    assert.equal(
      (await f.db.query("SELECT count(*)::int AS n FROM order_deletions WHERE id='44918'")).rows[0]
        .n,
      1,
    );
    const audit = (await f.db.query("SELECT count(*)::int AS n FROM audit WHERE order_id='44918'"))
      .rows[0].n;
    await applyRequestedMaintenance(f.db);
    assert.equal(
      (await f.db.query("SELECT count(*)::int AS n FROM audit WHERE order_id='44918'")).rows[0].n,
      audit,
    );
  } finally {
    await f.close();
  }
});
