---
name: database-changes
description: Steps for altering database tables, writing Drizzle schemas, generating migrations, and writing database queries in Arcanora.
---

# Making Database Schema Changes in Arcanora

Arcanora uses PostgreSQL with Drizzle ORM. Follow this workflow when altering the database schema:

## 1. Edit the Schema File
Open [schema.ts](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/src/database/schema.ts) and add or modify your table definitions:

```typescript
import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const newTable = pgTable('new_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  metaData: varchar('meta_data', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Don't forget to define relationships using Drizzle's `relations` helper if needed.

## 2. Generate the Migration File
To generate the SQL migration file in `./src/database/migrations/`, run the following command:
```bash
cmd /c npm run generate
```
This generates the migration script by comparing your typescript schema with existing migration files.

## 3. Apply the Migration
To apply the generated SQL migration to your database, run:
```bash
cmd /c npm run migrate
```
Ensure you have a valid `DATABASE_URL` configured in your `.env` file first.

## 4. Implement Database Queries
Write query functions in `src/database/queries/` to interface with the new table:

```typescript
import { db } from '../client.js';
import { newTable } from '../schema.js';
import { eq } from 'drizzle-orm';

export async function insertNewMeta(playerId: string, meta: string) {
  return await db.insert(newTable).values({
    playerId,
    metaData: meta
  }).returning();
}
```

> [!IMPORTANT]
> Always verify that all database interactions run inside a transaction if they involve multiple dependent steps (e.g. updating a player's gold and adding a transaction log entry).
