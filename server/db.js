import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function database() {
  let db;
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    db = {
      query: (...args) => client.query(...args),
      exec: (s) => client.query(s),
      close: async () => {
        client.release();
        await pool.end();
      },
    };
  } else {
    const dir = process.env.DATA_DIR || '.data';
    await fs.mkdir(dir, { recursive: true });
    db = new PGlite(path.resolve(dir, 'postgres'));
  }
  if (process.env.SKIP_SCHEMA !== 'true')
    await db.exec(await fs.readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  return db;
}
