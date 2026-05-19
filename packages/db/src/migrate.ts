import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL must be set for migrations');

const migrationClient = postgres(url, { max: 1, prepare: false });
const db = drizzle(migrationClient);

await migrate(db, { migrationsFolder: './migrations' });
await migrationClient.end();
console.log('Migrations applied.');
