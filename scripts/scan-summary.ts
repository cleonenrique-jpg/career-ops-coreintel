import postgres from 'postgres';
const url = process.env.DATABASE_URL_POOLER!;
const sql = postgres(url, { max: 1, prepare: false });

console.log('── scan_history by source ──');
const bySource = await sql<{ source: string; n: number }[]>`
  select source::text, count(*)::int as n from scan_history group by source order by n desc`;
for (const r of bySource) console.log(`  ${r.source.padEnd(14)} ${r.n}`);

console.log('\n── pipeline_urls inserted in last 5 min ──');
const recent = await sql<{ source: string; company: string; title: string; url: string }[]>`
  select source::text, company, title, url
  from pipeline_urls
  where scanned_at > now() - interval '5 minutes'
  order by scanned_at desc`;
for (const r of recent) console.log(`  [${r.source}] ${r.company ?? '?'} | ${r.title ?? '?'}\n    ${r.url}`);

console.log(`\nTotal new this run: ${recent.length}`);
await sql.end();
