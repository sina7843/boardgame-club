import { runMigrations } from '@bg/db';
import { TEST_DATABASE_URL } from './helpers.ts';

export default async function globalSetup(): Promise<void> {
  await runMigrations(TEST_DATABASE_URL);
}
