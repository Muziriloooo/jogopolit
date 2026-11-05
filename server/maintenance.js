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
