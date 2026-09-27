import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import * as schema from './schema.js';
import { runLocalMigrations } from './localMigrator.js';

export type ArcanoraDatabase = ReturnType<typeof drizzlePglite<typeof schema>> | ReturnType<typeof drizzlePg<typeof schema>>;

let globalDb: ArcanoraDatabase | null = null;
let globalPglite: PGlite | null = null;
let globalPool: pg.Pool | null = null;

export interface InitDbOptions {
  driver?: 'pglite' | 'pg';
  connectionString?: string;
  dataDir?: string; // e.g. 'idb://arcanora_db' or memory
  autoMigrate?: boolean;
}

/**
 * Initializes the database client.
 * Defaults to PGlite (local-first/zero-cloud) when no DATABASE_URL is provided.
 */
export async function initDatabase(options: InitDbOptions = {}): Promise<ArcanoraDatabase> {
  const isBrowser = typeof window !== 'undefined';
  const envUrl = typeof process !== 'undefined' && process.env ? process.env.DATABASE_URL : undefined;
  const driver = options.driver || (options.connectionString || envUrl ? 'pg' : 'pglite');

  if (driver === 'pglite' || isBrowser) {
    if (!globalPglite) {
      const dataDir = options.dataDir || (isBrowser ? 'idb://arcanora_db' : undefined);
      globalPglite = dataDir ? new PGlite(dataDir) : new PGlite();
    }

    if (options.autoMigrate !== false) {
      await runLocalMigrations(globalPglite);
    }

    globalDb = drizzlePglite(globalPglite, { schema });
    return globalDb;
  }

  // Node.js PostgreSQL pool
  const connectionString = options.connectionString || envUrl;
  if (!globalPool) {
    globalPool = new pg.Pool({
      connectionString,
      min: 2,
      max: 10,
    });
  }

  globalDb = drizzlePg(globalPool, { schema });
  return globalDb;
}

/**
 * Returns current database instance or creates default in-memory/PGlite instance synchronously/on-demand.
 */
export function getDb(): ArcanoraDatabase {
  if (!globalDb) {
    // Synchronous PGlite fallback for Node / test environments
    globalPglite = new PGlite();
    globalDb = drizzlePglite(globalPglite, { schema });
  }
  return globalDb;
}

// Proxied db export for backward-compatibility with direct `import { db } from ...`
export const db = new Proxy({} as ArcanoraDatabase, {
  get(_target, prop) {
    const active = getDb();
    const value = (active as any)[prop];
    return typeof value === 'function' ? value.bind(active) : value;
  }
});

export { globalPool as pool, globalPglite as pglite, schema };
