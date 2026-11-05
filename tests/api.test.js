import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import { createApp } from '../server/app.js';
test('API: sessions, role isolation, no prices, idempotency, conflict and audit', async () => {
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_PASSWORD = 'Only-for-tests-2026';
  const db = new PGlite();
  await db.exec(await fs.readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  const app = await createApp(db);
  await db.exec(
    'CREATE ROLE sl_test; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO sl_test; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO sl_test; SET ROLE sl_test;',
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const request = async (path, method = 'GET', body, cookie) => {
      const r = await fetch(base + '/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: r.status,
        data: await r.json(),
        cookie: r.headers.get('set-cookie')?.split(';')[0],
      };
    };
    assert.equal((await request('/orders')).status, 401);
    const login = await request('/login', 'POST', {
      email: 'tecnico@slcampo.local',
      password: 'Only-for-tests-2026',
    });
    assert.equal(login.status, 200);
    const cookie = login.cookie;
    const list = await request('/orders', 'GET', undefined, cookie);
    assert.equal(list.data.length, 1);
    const record = list.data[0];
    assert.equal(record.data.laborCents, undefined);
    assert.equal(record.data.parts[0].unitCents, undefined);
    const command = {
      commandId: crypto.randomUUID(),
      baseRevision: record.revision,
      data: record.data,
    };
    const originalQuery = db.query.bind(db);
    db.query = async (...args) => {
      if (args[0].includes('SELECT user_id,result FROM commands')) {
        throw Object.assign(new Error('Simulated temporary database outage'), { code: '57P01' });
      }
      return originalQuery(...args);
    };
    const temporary = await request('/sync', 'POST', command, cookie);
    assert.equal(temporary.status, 503);
    db.query = originalQuery;
    const first = await request('/sync', 'POST', command, cookie);
    assert.equal(first.status, 200, JSON.stringify(first.data));
    const retry = await request('/sync', 'POST', command, cookie);
    assert.equal(retry.data.revision, first.data.revision);
    const stale = await request(
      '/sync',
      'POST',
      { ...command, commandId: crypto.randomUUID() },
      cookie,
    );
    assert.equal(stale.status, 409);
    const next = structuredClone(first.data.data);
    next.parts[0].status = 'Aprovada';
    const invalid = await request(
      '/sync',
      'POST',
      { commandId: crypto.randomUUID(), baseRevision: first.data.revision, data: next },
      cookie,
    );
    assert.equal(invalid.status, 400);
    const audit = await request('/orders/41250/audit', 'GET', undefined, cookie);
    assert.equal(audit.data.length, 1);
    const hash = (await db.query("SELECT password_hash FROM users WHERE id='tec-demo'")).rows[0]
      .password_hash;
    await db.query('INSERT INTO users VALUES($1,$2,$3,$4,$5)', [
      'other',
      'Outro técnico',
      'other@test.local',
      hash,
      'tecnico',
    ]);
    const other = await request('/login', 'POST', {
      email: 'other@test.local',
      password: 'Only-for-tests-2026',
    });
    assert.equal((await request('/orders', 'GET', undefined, other.cookie)).data.length, 0);
    assert.equal(
      (await request('/sync', 'POST', { ...command, commandId: crypto.randomUUID() }, other.cookie))
        .status,
      400,
    );
    const boss = await request('/login', 'POST', {
      email: 'gestor@slcampo.local',
      password: 'Only-for-tests-2026',
    });
    let managed = (await request('/orders', 'GET', undefined, boss.cookie)).data[0];
    const push = async (rec, actor) => {
      const response = await request(
        '/sync',
        'POST',
        { commandId: crypto.randomUUID(), baseRevision: rec.revision, data: rec.data },
        actor,
      );
      assert.equal(response.status, 200, JSON.stringify(response.data));
      return response.data;
    };
    managed.data.parts[0].status = 'Aprovada';
    managed = await push(managed, boss.cookie);
    managed.data.parts[0].status = 'Entregue';
    managed = await push(managed, boss.cookie);
    let technical = (await request('/orders', 'GET', undefined, cookie)).data[0];
    const visit = {
      ...structuredClone(technical.data.visits[0]),
      id: 'return-api',
      checkIn: new Date().toISOString(),
    };
    delete visit.checkOut;
    technical.data.visits.push(visit);
    technical.data.status = 'Em andamento';
    technical = await push(technical, cookie);
    technical.data.parts[0].status = 'Instalada';
    technical.data.parts[0].installedVisitId = 'return-api';
    technical = await push(technical, cookie);
    assert.equal(technical.data.parts[0].status, 'Instalada');
    assert.equal(technical.data.parts[0].unitCents, undefined);
    technical.data.visits.at(-1).checkOut = new Date().toISOString();
    technical = await push(technical, cookie);
    assert.ok(technical.data.visits.at(-1).checkOut);
    await request('/logout', 'POST', {}, cookie);
    assert.equal((await request('/me', 'GET', undefined, cookie)).status, 401);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
  }
});
