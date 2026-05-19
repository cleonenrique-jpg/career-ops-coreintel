import postgres from 'postgres';

const url = process.env.DATABASE_URL_POOLER ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');

const sql = postgres(url, { max: 1, prepare: false });

const tables = ['profiles', 'cvs', 'applications', 'reports', 'pipeline_urls', 'scan_history', 'portals_config', 'story_bank'];

for (const t of tables) {
  const rows = await sql<{ n: number }[]>`select count(*)::int as n from ${sql(t)}`;
  console.log(`${t.padEnd(20)} ${rows[0]?.n ?? '?'}`);
}

await sql.end();
