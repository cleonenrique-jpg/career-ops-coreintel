// One-shot — apply the SQL files in supabase/migrations/ to the database
// pointed to by DATABASE_URL. Used for first-time setup.

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

// Prefer pooler (IPv4-friendly on Supabase free tier). For DDL we want session mode,
// but the transaction pooler also works for single-statement DDL files.
const url = process.env.DATABASE_URL_POOLER ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL or DATABASE_URL_POOLER required');

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, '..', 'supabase', 'migrations');

async function main() {
  const sql = postgres(url!, { max: 1, prepare: false });
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const f of files) {
    const content = await readFile(join(MIGRATIONS_DIR, f), 'utf-8');
    console.log(`\n── applying ${f} ──`);
    try {
      await sql.unsafe(content);
      console.log(`✓ ${f}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Tolerate "already exists" so re-runs are idempotent.
      if (msg.includes('already exists')) {
        console.log(`⚠ ${f} — partially applied (already exists): ${msg.slice(0, 120)}`);
      } else {
        await sql.end();
        throw err;
      }
    }
  }

  const tables = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  console.log(`\n✓ public tables: ${tables.map((t) => t.table_name).join(', ')}`);

  await sql.end();
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
