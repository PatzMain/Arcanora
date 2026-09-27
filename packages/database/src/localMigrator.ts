import { MIGRATION_SQL } from './migrationsBundle.js';
import type { PGlite } from '@electric-sql/pglite';

/**
 * Runs embedded database migrations against a PGlite instance.
 * Automatically checks if tables already exist to ensure idempotency.
 */
export async function runLocalMigrations(pglite: PGlite): Promise<void> {
  const checkResult = await pglite.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'players'
    );
  `);

  if (!checkResult.rows[0]?.exists) {
    await pglite.exec(MIGRATION_SQL);
  }
}
