import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './index.ts';
import { requireDatabaseUrl } from './env.ts';

export const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

export async function runMigrations(url: string): Promise<void> {
  const { db, close } = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}

if (import.meta.main) {
  await runMigrations(requireDatabaseUrl());
  console.log('migrations applied');
}
