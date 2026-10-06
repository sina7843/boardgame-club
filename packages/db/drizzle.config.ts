import { defineConfig } from 'drizzle-kit';

// `generate` only diffs the schema file; it never connects to a database.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  casing: 'snake_case'
});
