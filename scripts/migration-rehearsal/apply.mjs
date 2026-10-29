// Applies a migrations folder to a scratch database: node apply.mjs <folder> <url>
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { drizzle } = require('drizzle-orm/postgres-js');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const postgres = require('postgres');
const [folder, url] = process.argv.slice(2);
const sql = postgres(url, { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: folder });
await sql.end();
console.log('applied', folder);
