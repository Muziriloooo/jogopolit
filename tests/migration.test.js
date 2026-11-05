import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';
import { example } from '../server/seed.js';
import { createApp } from '../server/app.js';
test('migração mantém um login administrativo, preserva senha e referências e revoga o gestor', async () => {
  const db = new PGlite();
  let server;
  try {
    await db.exec(
      "CREATE TABLE users(id text PRIMARY KEY,name text NOT NULL,email text UNIQUE NOT NULL,password_hash text NOT NULL,role text NOT NULL CHECK(role IN ('tecnico','gestor','admin'))); CREATE TABLE sessions(token_hash text PRIMARY KEY,user_id text REFERENCES users(id),expires_at timestamptz NOT NULL);",
    );
    const adminHash = await bcrypt.hash('Admin-password-kept', 10),
      managerHash = await bcrypt.hash('Old-manager-password', 10);
    await db.query('INSERT INTO users VALUES($1,$2,$3,$4,$5)', [
      'adm-demo',
      'Administrador',
      'admin@test.local',
      adminHash,
      'admin',
    ]);
    await db.query('INSERT INTO users VALUES($1,$2,$3,$4,$5)', [
      'gest-demo',
      'Conta antiga',
      'gestor@test.local',
      managerHash,
      'gestor',
    ]);
    await db.query(
      "INSERT INTO sessions VALUES('old-session','gest-demo',now()+interval '1 hour')",
    );
    const schema = await fs.readFile(new URL('../server/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.query(
      "INSERT INTO audit(user_id,order_id,action) VALUES('gest-demo','old-order','Histórico preservado')",
    );
    await db.exec(schema);
    const rows = (await db.query('SELECT * FROM users ORDER BY id')).rows;
    assert.equal(rows.filter((r) => r.role === 'admin' && !r.disabled_at).length, 1);
    assert.equal(rows.find((r) => r.id === 'adm-demo').password_hash, adminHash);
    assert.equal(rows.find((r) => r.id === 'gest-demo').merged_into, 'adm-demo');
    assert.ok(rows.find((r) => r.id === 'gest-demo').disabled_at);
    assert.equal((await db.query('SELECT * FROM sessions')).rows.length, 0);
    assert.equal(
      (await db.query("SELECT user_id FROM audit WHERE order_id='old-order'")).rows[0].user_id,
      'gest-demo',
    );
    const oldData = { ...example(), id: 'archived-work', technicianId: 'gest-demo' };
    const oldCommand = crypto.randomUUID();
    await db.query('INSERT INTO orders(id,technician_id,revision,data) VALUES($1,$2,$3,$4)', [
      oldData.id,
      'gest-demo',
      1,
      JSON.stringify(oldData),
    ]);
    await db.query('INSERT INTO commands VALUES($1,$2,$3,$4)', [
      oldCommand,
      'gest-demo',
      oldData.id,
      JSON.stringify({ data: oldData, revision: 1 }),
    ]);
    process.env.DEMO_MODE = 'true';
    const app = await createApp(db);
    server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const url = 'http://127.0.0.1:' + server.address().port;
    const login = async (email, password) =>
      fetch(url + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    assert.equal((await login('gestor@test.local', 'Old-manager-password')).status, 401);
    const result = await login('admin@test.local', 'Admin-password-kept');
    assert.equal(result.status, 200);
    const adminCookie = result.headers.get('set-cookie').split(';')[0];
    const replay = await fetch(url + '/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ commandId: oldCommand, baseRevision: 0, data: oldData }),
    });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).revision, 1);
    const payload = await result.json();
    assert.deepEqual(payload.user.mergedUserIds, ['gest-demo']);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await db.close();
  }
});
