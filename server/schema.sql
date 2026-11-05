CREATE TABLE IF NOT EXISTS users(id text PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('tecnico','admin')));
CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY, user_id text REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id text PRIMARY KEY, technician_id text REFERENCES users(id), revision integer NOT NULL DEFAULT 1, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS commands(id text PRIMARY KEY, user_id text REFERENCES users(id), order_id text NOT NULL, result jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id bigserial PRIMARY KEY, user_id text REFERENCES users(id), order_id text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS orders_technician ON orders(technician_id);
-- API sets the actor for each transaction. Restrict direct database access to the API account.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_access ON orders;
CREATE POLICY order_access ON orders USING (current_setting('app.role',true)='admin' OR technician_id=current_setting('app.user_id',true)) WITH CHECK (current_setting('app.role',true)='admin' OR technician_id=current_setting('app.user_id',true));
-- Minimal tombstones prevent deleted calls from returning from an offline device.
CREATE TABLE IF NOT EXISTS order_deletions(id text PRIMARY KEY, technician_id text REFERENCES users(id), deleted_by text REFERENCES users(id), deleted_at timestamptz NOT NULL DEFAULT now());
-- One active administrative login. Archived accounts retain audit/OS references.
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS merged_into text REFERENCES users(id);
DO $$
DECLARE canonical text;
BEGIN
  SELECT id INTO canonical FROM users
  WHERE disabled_at IS NULL AND role IN ('admin','gestor')
  ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END,
           CASE WHEN id IN ('adm-demo','admin') THEN 0 ELSE 1 END, id LIMIT 1;
  IF canonical IS NOT NULL THEN
    UPDATE users SET disabled_at=now(),merged_into=canonical
    WHERE role IN ('admin','gestor') AND id<>canonical AND disabled_at IS NULL;
  END IF;
  UPDATE users SET role='admin' WHERE role='gestor';
  DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE disabled_at IS NOT NULL);
END $$;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('tecnico','admin'));
CREATE UNIQUE INDEX IF NOT EXISTS one_active_administrator ON users(role) WHERE role='admin' AND disabled_at IS NULL;
DROP POLICY IF EXISTS order_access ON orders;
CREATE POLICY order_access ON orders USING (current_setting('app.role',true)='admin' OR technician_id=current_setting('app.user_id',true)) WITH CHECK (current_setting('app.role',true)='admin' OR technician_id=current_setting('app.user_id',true));
CREATE TABLE IF NOT EXISTS applied_maintenance(id text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());
