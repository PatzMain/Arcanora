import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema.js';
import { runLocalMigrations } from './localMigrator.js';

export type ArcanoraDatabase = ReturnType<typeof drizzle<typeof schema>>;

let globalDb: ArcanoraDatabase | null = null;
let globalPglite: PGlite | null = null;

export interface InitDbOptions {
  driver?: 'pglite';
  dataDir?: string; // e.g. 'idb://arcanora_db' in browser or in-memory
  autoMigrate?: boolean;
}

/**
 * Initializes the local-first embedded PGlite WASM database.
 * Supports IndexedDB persistence in the browser (`idb://arcanora_db`)
 * and memory/local directory in Node.js.
 */
export async function initDatabase(options: InitDbOptions = {}): Promise<ArcanoraDatabase> {
  const isBrowser = typeof window !== 'undefined';

  if (!globalPglite) {
    const dataDir = options.dataDir || (isBrowser ? 'idb://arcanora_db' : undefined);
    globalPglite = dataDir ? new PGlite(dataDir) : new PGlite();
  }

  if (options.autoMigrate !== false) {
    await runLocalMigrations(globalPglite);
  }

  globalDb = drizzle(globalPglite as any, { schema });
  return globalDb;
}

/**
 * Returns current database instance or creates default in-memory/PGlite instance synchronously/on-demand.
 */
export function getDb(): ArcanoraDatabase {
  if (!globalDb) {
    globalPglite = new PGlite();
    globalDb = drizzle(globalPglite as any, { schema });
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

export { globalPglite as pglite, schema };
