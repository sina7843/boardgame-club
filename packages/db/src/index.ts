import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

export * as schema from './schema.ts';
export { gameRegistry } from './registry.ts';

export function createDb(url: string, opts: { max?: number } = {}) {
  const client = postgres(url, { max: opts.max ?? 10, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: 'snake_case' });
  return { db, client, close: () => client.end({ timeout: 5 }) };
}

export type Db = ReturnType<typeof createDb>['db'];
export { seed } from './seed.ts';
export { runMigrations } from './migrate.ts';
