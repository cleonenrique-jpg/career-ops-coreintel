import postgres from 'postgres';
const url = process.env.DATABASE_URL_POOLER!;
const sql = postgres(url, { max: 1, prepare: false });

const tables = ['profiles', 'cvs', 'applications', 'reports', 'pipeline_urls', 'scan_history', 'portals_config', 'story_bank'];
for (const t of tables) {
  const rows = await sql<{ n: number }[]>`select count(*)::int as n from ${sql(t)}`;
  console.log(`${t.padEnd(20)} ${rows[0]?.n ?? '?'}`);
}

console.log('\n── Pipeline by status ──');
const pipe = await sql<{ status: string; n: number }[]>`select status, count(*)::int as n from pipeline_urls group by status order by status`;
for (const r of pipe) console.log(`  ${r.status.padEnd(12)} ${r.n}`);

console.log('\n── Applications ──');
const apps = await sql<{ num: number; company: string; role: string; score: string; status: string }[]>`select num, company, role, score::text, status from applications order by num`;
for (const a of apps) console.log(`  #${a.num} ${a.company} — ${a.role} (${a.score}/5, ${a.status})`);

console.log('\n── Active CV ──');
const cv = await sql<{ version: number; len: number }[]>`select version, length(content_md) as len from cvs where is_active`;
for (const c of cv) console.log(`  v${c.version}, ${c.len} chars`);

await sql.end();
