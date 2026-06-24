import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  throw new Error('DATABASE_URL environment variable is missing. Please configure your database connection string.');
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '10'),
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

export const db = drizzle(pool, { schema });
export { pool };
