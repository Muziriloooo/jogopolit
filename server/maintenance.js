import bcrypt from 'bcryptjs';

/** Creates the explicitly requested demo technician once, without recreating it after deletion. */
export async function ensureRequestedTestTechnician(db, password) {
  const key = 'requested-test-technician-v1';
  if ((await db.query('SELECT id FROM applied_maintenance WHERE id=$1', [key])).rows.length) return;
  await db.exec('BEGIN');
  try {
    const claimed = await db.query(
      'INSERT INTO applied_maintenance(id) VALUES($1) ON CONFLICT(id) DO NOTHING RETURNING id',
      [key],
    );
    if (!claimed.rows.length) {
      await db.exec('COMMIT');
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',
      ['tec-teste', 'Técnico de teste', 'tecnico.teste@slcampo.local', hash, 'tecnico'],
    );
    const admin = (
      await db.query("SELECT id FROM users WHERE role='admin' AND disabled_at IS NULL LIMIT 1")
    ).rows[0]?.id;
    await db.query('INSERT INTO audit(user_id,order_id,action) VALUES($1,$2,$3)', [
      admin || null,
      '*',
      'Criação solicitada do login Técnico de teste',
    ]);
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

/** Repairs imported calls that an older client accidentally assigned to the administrator. */
export async function assignImportedCallsToTestTechnician(db) {
  const key = 'assign-imported-calls-to-test-technician-v1';
  if ((await db.query('SELECT id FROM applied_maintenance WHERE id=$1', [key])).rows.length) return;
  await db.exec('BEGIN');
  try {
    const claimed = await db.query(
      'INSERT INTO applied_maintenance(id) VALUES($1) ON CONFLICT(id) DO NOTHING RETURNING id',
      [key],
    );
    if (!claimed.rows.length) {
      await db.exec('COMMIT');
      return;
    }
    const technician = (
      await db.query(
        "SELECT id,name FROM users WHERE id='tec-teste' AND role='tecnico' AND disabled_at IS NULL",
      )
    ).rows[0];
    if (technician) {
      const admin = (
        await db.query("SELECT id FROM users WHERE role='admin' AND disabled_at IS NULL LIMIT 1")
      ).rows[0]?.id;
      await db.query("SELECT set_config('app.role','admin',true)");
      const rows = (
        await db.query(
          "SELECT o.id,o.data FROM orders o JOIN users u ON u.id=o.technician_id WHERE u.role='admin' FOR UPDATE",
        )
      ).rows;
      for (const row of rows) {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        if (!data?.sourcePdf || data.status === 'Concluída') continue;
        const repaired = {
          ...data,
          technicianId: technician.id,
          technicianName: technician.name,
        };
        await db.query(
          'UPDATE orders SET technician_id=$1,data=$2,revision=revision+1 WHERE id=$3',
          [technician.id, JSON.stringify(repaired), row.id],
        );
        await db.query('INSERT INTO audit(user_id,order_id,action) VALUES($1,$2,$3)', [
          admin || null,
          row.id,
          'Chamado importado atribuído ao Técnico de teste',
        ]);
      }
    }
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

/** Removes the old Lucas demo account and transfers its calls to the requested test technician. */
export async function removeLegacyDemoTechnician(db) {
  const key = 'remove-legacy-demo-technician-v1';
  if ((await db.query('SELECT id FROM applied_maintenance WHERE id=$1', [key])).rows.length) return;
  await db.exec('BEGIN');
  try {
    const claimed = await db.query(
      'INSERT INTO applied_maintenance(id) VALUES($1) ON CONFLICT(id) DO NOTHING RETURNING id',
      [key],
    );
    if (!claimed.rows.length) {
      await db.exec('COMMIT');
      return;
    }
    const legacy = (
      await db.query("SELECT id FROM users WHERE id='tec-demo' AND role='tecnico' FOR UPDATE")
    ).rows[0];
    const technician = (
      await db.query(
        "SELECT id,name FROM users WHERE id='tec-teste' AND role='tecnico' AND disabled_at IS NULL",
      )
    ).rows[0];
    if (legacy && technician) {
      const admin = (
        await db.query("SELECT id FROM users WHERE role='admin' AND disabled_at IS NULL LIMIT 1")
      ).rows[0]?.id;
      await db.query("SELECT set_config('app.role','admin',true)");
      const orders = (
        await db.query("SELECT id,data FROM orders WHERE technician_id='tec-demo' FOR UPDATE")
      ).rows;
      for (const row of orders) {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const transferred = {
          ...data,
          technicianId: technician.id,
          technicianName: technician.name,
        };
        await db.query(
          'UPDATE orders SET technician_id=$1,data=$2,revision=revision+1 WHERE id=$3',
          [technician.id, JSON.stringify(transferred), row.id],
        );
      }
      const orderIds = orders.map((row) => row.id);
      if (orderIds.length)
        await db.query('DELETE FROM commands WHERE order_id=ANY($1::text[])', [orderIds]);
      await db.query("DELETE FROM sessions WHERE user_id='tec-demo'");
      await db.query("DELETE FROM commands WHERE user_id='tec-demo'");
      await db.query("UPDATE audit SET user_id=NULL WHERE user_id='tec-demo'");
      await db.query("UPDATE order_deletions SET technician_id=$1 WHERE technician_id='tec-demo'", [
        technician.id,
      ]);
      await db.query("UPDATE order_deletions SET deleted_by=NULL WHERE deleted_by='tec-demo'");
      await db.query("DELETE FROM users WHERE id='tec-demo'");
      await db.query('INSERT INTO audit(user_id,order_id,action) VALUES($1,$2,$3)', [
        admin || null,
        '*',
        `Conta legada Lucas removida; ${orders.length} chamados transferidos ao Técnico de teste`,
      ]);
    }
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

/** Explicit one-time cleanup requested for OS 44918. Never clears other calls. */
export async function applyRequestedMaintenance(db) {
  const key = 'requested-delete-order-44918-v1';
  if ((await db.query('SELECT id FROM applied_maintenance WHERE id=$1', [key])).rows.length) return;
  await db.exec('BEGIN');
  try {
    const claimed = await db.query(
      'INSERT INTO applied_maintenance(id) VALUES($1) ON CONFLICT(id) DO NOTHING RETURNING id',
      [key],
    );
    if (!claimed.rows.length) {
      await db.exec('COMMIT');
      return;
    }
    const admin = (
      await db.query("SELECT id FROM users WHERE role='admin' AND disabled_at IS NULL LIMIT 1")
    ).rows[0]?.id;
    await db.query("SELECT set_config('app.role','admin',true)");
    const row = (
      await db.query('SELECT technician_id FROM orders WHERE id=$1 FOR UPDATE', ['44918'])
    ).rows[0];
    await db.query(
      'INSERT INTO order_deletions(id,technician_id,deleted_by) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',
      ['44918', row?.technician_id || admin || null, admin || null],
    );
    await db.query('DELETE FROM commands WHERE order_id=$1', ['44918']);
    await db.query('DELETE FROM audit WHERE order_id=$1', ['44918']);
    await db.query('DELETE FROM orders WHERE id=$1', ['44918']);
    await db.query('INSERT INTO audit(user_id,order_id,action) VALUES($1,$2,$3)', [
      admin || null,
      '44918',
      'Exclusão da OS 44918 solicitada pelo administrador',
    ]);
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
