import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { createPool } from './pool.js';
import type pg from 'pg';

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url));

/** Applies each pending .sql file once, in filename order, each in its own transaction. */
export async function migrate(pool: pg.Pool): Promise<string[]> {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
  );
  const done = new Set((await pool.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(MIGRATIONS_DIR + file, 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return applied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool(loadConfig());
  migrate(pool)
    .then((applied) => console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database up to date'))
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
