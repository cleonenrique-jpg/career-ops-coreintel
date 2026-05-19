import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const url = process.env.DATABASE_URL_POOLER ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL or DATABASE_URL_POOLER must be set');
}

// Single global connection — workers should set this up once and reuse.
const queryClient = postgres(url, { prepare: false });
export const db = drizzle(queryClient, { schema });

export { schema };
export type Database = typeof db;
