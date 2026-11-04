CREATE TABLE IF NOT EXISTS users(id text PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('tecnico','gestor','admin')));
CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY, user_id text REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id text PRIMARY KEY, technician_id text REFERENCES users(id), revision integer NOT NULL DEFAULT 1, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS commands(id text PRIMARY KEY, user_id text REFERENCES users(id), order_id text NOT NULL, result jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id bigserial PRIMARY KEY, user_id text REFERENCES users(id), order_id text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS orders_technician ON orders(technician_id);
-- API sets the actor for each transaction. Restrict direct database access to the API account.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_access ON orders;
CREATE POLICY order_access ON orders USING (current_setting('app.role',true) IN ('admin','gestor') OR technician_id=current_setting('app.user_id',true)) WITH CHECK (current_setting('app.role',true) IN ('admin','gestor') OR technician_id=current_setting('app.user_id',true));
