import pg from 'pg';
import type { Config } from '../config.js';

export type Db = Pick<pg.Pool, 'query' | 'end'>;

export function createPool(config: Pick<Config, 'DATABASE_URL' | 'DATABASE_SSL'>): pg.Pool {
  return new pg.Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 10,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
  });
}
