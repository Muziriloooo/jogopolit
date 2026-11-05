import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { orderIdentifier, deletionIdentifiers } from '../shared/order-identifiers.js';
import { example } from './seed.js';
import { applyRequestedMaintenance } from './maintenance.js';
import {
  orderSchema,
  sanitize,
  validateTransition,
  validateInitialOrder,
  validationMessage,
} from './domain.js';
const hash = (s) => createHash('sha256').update(s).digest('hex');
export async function createApp(db) {
  const app = express();
  const updates = new EventEmitter();
  updates.setMaxListeners(0);
  const liveClients = new Set();
  app.locals.closeLiveConnections = () => {
    for (const response of liveClients) response.end();
  };
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:'],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'upgrade-insecure-requests': null,
        },
      },
    }),
  );
  app.use(express.json({ limit: '28mb' }));
  const demo = process.env.DEMO_MODE === 'true';
  if (
    process.env.NODE_ENV === 'production' &&
    (demo || process.env.COOKIE_SECURE !== 'true' || !process.env.DATABASE_URL)
  )
    throw Error('Produção exige PostgreSQL externo, COOKIE_SECURE=true e DEMO_MODE=false.');
  const existing = await db.query('SELECT id FROM users LIMIT 1');
  if (!existing.rows.length) {
    if (demo) {
      if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12)
        throw Error('Defina DEMO_PASSWORD com pelo menos 12 caracteres.');
      for (const [id, name, email, role] of [
        ['adm-demo', 'Administrador', 'admin@slcampo.local', 'admin'],
      ])
        await db.query(
          'INSERT INTO users(id,name,email,password_hash,role) VALUES ($1,$2,$3,$4,$5)',
          [id, name, email, await bcrypt.hash(process.env.DEMO_PASSWORD, 12), role],
        );
      // Examples are opt-in for isolated automated tests, never the default installation.
      if (process.env.DEMO_SEED_EXAMPLES === 'true') {
        await db.query(
          'INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',
          [
            'tec-demo',
            'Lucas Ferreira',
            'tecnico@slcampo.local',
            await bcrypt.hash(process.env.DEMO_PASSWORD, 12),
            'tecnico',
          ],
        );
        const o = example();
        await db.query('INSERT INTO orders(id,technician_id,data) VALUES($1,$2,$3)', [
          o.id,
          o.technicianId,
          JSON.stringify(o),
        ]);
      }
    } else {
      if (!process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD?.length < 12)
        throw Error('Configure ADMIN_EMAIL e ADMIN_PASSWORD (12+ caracteres).');
      await db.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [
        'admin',
        'Administrador',
        process.env.ADMIN_EMAIL,
        await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
        'admin',
      ]);
    }
  }
  await applyRequestedMaintenance(db);
  // Serialize work on the shared embedded/pooled connection; transactions cannot interleave.
  let tail = Promise.resolve();
  const serial = (fn) => {
    const job = tail.then(fn);
    tail = job.catch(() => {});
    return job;
  };
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.headers['sec-fetch-site'] === 'cross-site')
      return res.status(403).json({ error: 'Origem não autorizada.' });
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', async (req, res) => {
    try {
      await serial(() => db.query('SELECT 1'));
      res.json({ ok: true, demo });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  app.post(
    '/api/login',
    rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: true, legacyHeaders: false }),
    async (req, res) => {
      try {
        const { email, password } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string' || password.length > 200)
          return res.status(400).json({ error: 'Informe e-mail e senha.' });
        const result = await serial(() =>
          db.query('SELECT * FROM users WHERE email=$1 AND disabled_at IS NULL', [
            email.toLowerCase().trim(),
          ]),
        );
        const u = result.rows[0];
        if (!u || !(await bcrypt.compare(password, u.password_hash)))
          return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
        const token = randomBytes(32).toString('hex');
        await serial(() =>
          db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '12 hours')", [
            hash(token),
            u.id,
          ]),
        );
        res.cookie('sl_session', token, {
          httpOnly: true,
          sameSite: 'strict',
          secure: process.env.COOKIE_SECURE === 'true',
          maxAge: 12 * 3600000,
          path: '/',
        });
        const aliases =
          u.role === 'admin'
            ? (
                await serial(() => db.query('SELECT id FROM users WHERE merged_into=$1', [u.id]))
              ).rows.map((row) => row.id)
            : [];
        res.json({
          user: { id: u.id, name: u.name, email: u.email, role: u.role, mergedUserIds: aliases },
          demo,
        });
      } catch {
        res.status(500).json({ error: 'Não foi possível entrar.' });
      }
    },
  );
  app.use('/api', async (req, res, next) => {
    const token = (req.headers.cookie || '')
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('sl_session='))
      ?.slice(11);
    if (!token) return res.status(401).json({ error: 'Entre novamente para sincronizar.' });
    try {
      const r = await serial(() =>
        db.query(
          'SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.disabled_at IS NULL',
          [hash(token)],
        ),
      );
      if (!r.rows[0])
        return res
          .status(401)
          .json({ error: 'Sessão expirada. Seus rascunhos permanecem neste dispositivo.' });
      req.user = r.rows[0];
      req.token = token;
      next();
    } catch {
      res.status(503).json({ error: 'Banco indisponível.' });
    }
  });
  app.get('/api/me', async (req, res) => {
    const aliases =
      req.user.role === 'admin'
        ? (
            await serial(() => db.query('SELECT id FROM users WHERE merged_into=$1', [req.user.id]))
          ).rows.map((row) => row.id)
        : [];
    res.json({ user: { ...req.user, mergedUserIds: aliases }, demo });
  });
  app.post('/api/logout', async (req, res) => {
    await serial(() => db.query('DELETE FROM sessions WHERE token_hash=$1', [hash(req.token)]));
    res.clearCookie('sl_session');
    res.json({ ok: true });
  });
  app.get('/api/users', async (req, res) =>
    res.json(
      (
        await serial(() =>
          db.query(
            "SELECT id,name,role FROM users WHERE role='tecnico' AND disabled_at IS NULL ORDER BY name",
          ),
        )
      ).rows,
    ),
  );
  app.post('/api/users', async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administrador.' });
    const { name, email, password, role } = req.body;
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password?.length < 12 || role !== 'tecnico')
      return res.status(400).json({
        error: 'Informe nome, e-mail e senha de 12+ caracteres para cadastrar um técnico.',
      });
    try {
      const passwordHash = await bcrypt.hash(password, 12);
      await serial(() =>
        db.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [
          crypto.randomUUID(),
          name,
          email.toLowerCase(),
          passwordHash,
          role,
        ]),
      );
      res.status(201).json({ ok: true });
    } catch {
      res.status(409).json({ error: 'E-mail já cadastrado.' });
    }
  });
  const actorQuery = (user, sql, args = []) =>
    serial(async () => {
      await db.exec('BEGIN');
      try {
        await db.query("SELECT set_config('app.role',$1,true),set_config('app.user_id',$2,true)", [
          user.role,
          user.id,
        ]);
        const result = await db.query(sql, args);
        await db.exec('COMMIT');
        return result;
      } catch (e) {
        await db.exec('ROLLBACK');
        throw e;
      }
    });
  app.get('/api/events', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    liveClients.add(res);
    res.locals.liveUserId = req.user.id;
    const write = (data) => {
      if (!res.writableEnded && !res.destroyed) res.write(data);
    };
    const send = () => write('data: {"type":"orders-changed"}\n\n');
    const changed = (audience) => {
      if (req.user.role !== 'tecnico' || audience.includes(req.user.id)) send();
    };
    updates.on('orders', changed);
    write('data: {"type":"ready"}\n\n');
    const heartbeat = setInterval(() => write(': heartbeat\n\n'), 20000);
    const expires = setTimeout(() => res.end(), 5 * 60000);
    heartbeat.unref();
    expires.unref();
    res.on('close', () => {
      clearInterval(heartbeat);
      clearTimeout(expires);
      liveClients.delete(res);
      updates.off('orders', changed);
    });
  });
  app.delete('/api/technicians', async (req, res) => {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Somente o administrador pode excluir técnicos.' });
    try {
      const result = await serial(async () => {
        await db.exec('BEGIN');
        try {
          await db.query(
            "SELECT set_config('app.role',$1,true),set_config('app.user_id',$2,true)",
            [req.user.role, req.user.id],
          );
          const ids = (
            await db.query("SELECT id FROM users WHERE role='tecnico' FOR UPDATE")
          ).rows.map((row) => row.id);
          if (
            (
              await db.query('SELECT id FROM orders WHERE technician_id=ANY($1::text[]) LIMIT 1', [
                ids,
              ])
            ).rows.length
          ) {
            await db.exec('ROLLBACK');
            return { blocked: true };
          }
          await db.query('DELETE FROM sessions WHERE user_id=ANY($1::text[])', [ids]);
          await db.query('DELETE FROM commands WHERE user_id=ANY($1::text[])', [ids]);
          await db.query('UPDATE audit SET user_id=NULL WHERE user_id=ANY($1::text[])', [ids]);
          await db.query(
            'UPDATE order_deletions SET technician_id=NULL WHERE technician_id=ANY($1::text[])',
            [ids],
          );
          await db.query(
            'UPDATE order_deletions SET deleted_by=NULL WHERE deleted_by=ANY($1::text[])',
            [ids],
          );
          await db.query("DELETE FROM users WHERE role='tecnico' AND id=ANY($1::text[])", [ids]);
          if (ids.length)
            await db.query('INSERT INTO audit(user_id,order_id,action) VALUES($1,$2,$3)', [
              req.user.id,
              '*',
              `Exclusão administrativa de ${ids.length} técnicos`,
            ]);
          await db.exec('COMMIT');
          return { ids };
        } catch (error) {
          await db.exec('ROLLBACK');
          throw error;
        }
      });
      if (result.blocked)
        return res.status(409).json({
          error: 'Exclua ou redistribua os chamados atribuídos antes de excluir os técnicos.',
        });
      for (const response of liveClients)
        if (result.ids.includes(response.locals.liveUserId)) response.end();
      if (result.ids.length) updates.emit('orders', []);
      res.json({ deleted: result.ids.length });
    } catch {
      res.status(503).json({ error: 'Não foi possível excluir os técnicos. Tente novamente.' });
    }
  });
  app.get('/api/order-deletions', async (req, res) => {
    const result = await serial(() =>
      db.query(
        req.user.role === 'tecnico'
          ? 'SELECT id FROM order_deletions WHERE technician_id=$1'
          : 'SELECT id FROM order_deletions',
        req.user.role === 'tecnico' ? [req.user.id] : [],
      ),
    );
    res.json(result.rows.map((row) => row.id));
  });
  const deleteOrders = async (req, res) => {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Somente o administrador pode excluir atendimentos.' });
    const single = req.method === 'POST' || Object.hasOwn(req.params, 'id');
    let requested;
    try {
      requested = deletionIdentifiers(
        single ? [req.params.id ?? req.body?.id] : (req.body?.ids ?? []),
      );
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    try {
      const removed = await serial(async () => {
        await db.exec('BEGIN');
        try {
          await db.query(
            "SELECT set_config('app.role',$1,true),set_config('app.user_id',$2,true)",
            [req.user.role, req.user.id],
          );
          const rows = (
            await db.query(
              single
                ? 'SELECT id,technician_id FROM orders WHERE id=$1 FOR UPDATE'
                : 'SELECT id,technician_id FROM orders FOR UPDATE',
              single ? [requested[0]] : [],
            )
          ).rows;
          for (const id of requested)
            if (!rows.some((row) => row.id === id)) rows.push({ id, technician_id: req.user.id });
          const ids = rows.map((row) => row.id);
          for (const row of rows)
            await db.query(
              'INSERT INTO order_deletions(id,technician_id,deleted_by) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',
              [row.id, row.technician_id, req.user.id],
            );
          if (ids.length) {
            await db.query('DELETE FROM commands WHERE order_id=ANY($1::text[])', [ids]);
            await db.query('DELETE FROM audit WHERE order_id=ANY($1::text[])', [ids]);
            await db.query('DELETE FROM orders WHERE id=ANY($1::text[])', [ids]);
            await db.query('INSERT INTO audit(user_id,order_id,action) VALUES($1,$2,$3)', [
              req.user.id,
              '*',
              `Exclusão administrativa de ${ids.length} chamados`,
            ]);
          }
          await db.exec('COMMIT');
          return rows;
        } catch (error) {
          await db.exec('ROLLBACK');
          throw error;
        }
      });
      if (removed.length)
        updates.emit(
          'orders',
          removed.map((row) => row.technician_id),
        );
      res.json({ deleted: removed.length, ids: removed.map((row) => row.id) });
    } catch {
      res.status(503).json({
        error:
          'Não foi possível excluir os chamados. Nenhum registro foi alterado; tente novamente.',
      });
    }
  };
  app.delete('/api/orders', deleteOrders);
  app.delete('/api/orders/:id', deleteOrders);
  app.post('/api/order-deletions', deleteOrders);
  app.get('/api/orders', async (req, res) => {
    const r = await actorQuery(
      req.user,
      req.user.role === 'tecnico'
        ? 'SELECT * FROM orders WHERE technician_id=$1'
        : 'SELECT * FROM orders',
      req.user.role === 'tecnico' ? [req.user.id] : [],
    );
    res.json(
      r.rows.map((r) => ({
        data: { ...sanitize(r.data, req.user.role), id: r.id },
        revision: r.revision,
      })),
    );
  });
  app.get('/api/orders/:id/audit', async (req, res) => {
    const r = await actorQuery(req.user, 'SELECT technician_id FROM orders WHERE id=$1', [
      req.params.id,
    ]);
    if (!r.rows[0] || (req.user.role === 'tecnico' && r.rows[0].technician_id !== req.user.id))
      return res.sendStatus(404);
    res.json(
      (
        await serial(() =>
          db.query(
            'SELECT a.action,a.created_at,u.name FROM audit a JOIN users u ON a.user_id=u.id WHERE order_id=$1 ORDER BY a.id DESC',
            [req.params.id],
          ),
        )
      ).rows,
    );
  });
  app.post('/api/sync', async (req, res) => {
    try {
      const { commandId, baseRevision, data } = req.body;
      if (!/^[0-9a-f-]{36}$/.test(commandId) || !Number.isInteger(baseRevision) || baseRevision < 0)
        return res.status(400).json({ error: 'Comando inválido.' });
      let next = orderSchema.parse({ ...data, id: orderIdentifier(data?.id) });
      const user = req.user;
      let audience;
      const result = await serial(async () => {
        await db.exec('BEGIN');
        try {
          await db.query(
            "SELECT set_config('app.role',$1,true),set_config('app.user_id',$2,true)",
            [user.role, user.id],
          );
          if (
            (await db.query('SELECT id FROM order_deletions WHERE id=$1', [next.id])).rows.length
          ) {
            await db.exec('ROLLBACK');
            return { deleted: true };
          }
          const cached = await db.query('SELECT user_id,result FROM commands WHERE id=$1', [
            commandId,
          ]);
          if (cached.rows.length) {
            if (cached.rows[0].user_id !== user.id) {
              const merged =
                user.role === 'admin' &&
                (
                  await db.query(
                    'SELECT id FROM users WHERE id=$1 AND merged_into=$2 AND disabled_at IS NOT NULL',
                    [cached.rows[0].user_id, user.id],
                  )
                ).rows.length;
              if (!merged) throw Error('Comando pertence a outro usuário.');
            }
            await db.exec('COMMIT');
            return cached.rows[0].result;
          }
          const r = await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [next.id]);
          const prev = r.rows[0];
          if (prev && user.role === 'tecnico' && prev.technician_id !== user.id)
            throw Error('OS não atribuída a você.');
          if (!prev && user.role === 'tecnico') throw Error('Somente o administrador cadastra OS.');
          if ((prev?.revision || 0) !== baseRevision) {
            await db.exec('ROLLBACK');
            return { conflict: true, revision: prev?.revision || 0 };
          }
          if (prev) {
            for (const v of next.visits)
              if (!prev.data.visits.some((old) => old.id === v.id)) {
                v.technicianId = user.id;
                v.technicianName =
                  user.role === 'admin' ? next.technicianName?.trim() || 'A definir' : user.name;
              }
            next = validateTransition(next, prev.data, user);
          } else {
            next = validateInitialOrder(next, user);
          }
          const revision = baseRevision + 1;
          if (prev)
            await db.query('UPDATE orders SET data=$1,revision=$2,technician_id=$3 WHERE id=$4', [
              JSON.stringify(next),
              revision,
              next.technicianId,
              next.id,
            ]);
          else
            await db.query('INSERT INTO orders VALUES($1,$2,$3,$4)', [
              next.id,
              next.technicianId,
              revision,
              JSON.stringify(next),
            ]);
          const changes = [];
          if (prev) {
            for (const part of next.parts) {
              const old = prev.data.parts.find((p) => p.id === part.id);
              if (!old || old.status !== part.status)
                changes.push(`${part.code}: ${old?.status || 'Nova'} → ${part.status}`);
            }
            if (next.visits.length > prev.data.visits.length)
              changes.push('Nova visita / check-in');
            if (
              next.visits.filter((v) => v.checkOut).length >
              prev.data.visits.filter((v) => v.checkOut).length
            )
              changes.push('Check-out / laudo finalizado');
            if (prev.technician_id !== next.technicianId)
              changes.push('Alteração de técnico responsável');
          }
          const action = prev
            ? `Atualização · ${next.status} · revisão ${revision}${changes.length ? ' · ' + changes.join('; ') : ''}`
            : 'Cadastro de ordem de serviço';
          await db.query('INSERT INTO audit(user_id,order_id,action) VALUES($1,$2,$3)', [
            user.id,
            next.id,
            action,
          ]);
          const result = { data: sanitize(next, user.role), revision };
          await db.query('INSERT INTO commands VALUES($1,$2,$3,$4)', [
            commandId,
            user.id,
            next.id,
            JSON.stringify(result),
          ]);
          await db.exec('COMMIT');
          audience = [next.technicianId, prev?.technician_id].filter(Boolean);
          return result;
        } catch (e) {
          await db.exec('ROLLBACK');
          throw e;
        }
      });
      if (result.deleted)
        return res.status(410).json({
          error:
            'Este chamado foi excluído pelo administrador e não pode ser restaurado pela sincronização.',
        });
      if (result.conflict)
        return res.status(409).json({
          error:
            'Esta OS mudou no servidor. Seu rascunho foi preservado. Exporte-o antes de carregar a versão atual.',
          ...result,
        });
      if (audience) updates.emit('orders', audience);
      res.json(result);
    } catch (e) {
      const databaseUnavailable = typeof e.code === 'string' && !e.code.startsWith('23');
      res.status(databaseUnavailable ? 503 : 400).json({
        error: databaseUnavailable
          ? 'Banco temporariamente indisponível. Os registros continuam na fila para nova tentativa.'
          : e.name === 'ZodError'
            ? validationMessage(e)
            : e.message,
      });
    }
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso não encontrado.' }));
  app.use((err, req, res, next) =>
    res.status(err.status || 500).json({
      error:
        err.type === 'entity.too.large'
          ? 'Limite de 28 MB excedido. Reduza as imagens.'
          : 'Falha ao processar a solicitação.',
    }),
  );
  return app;
}
