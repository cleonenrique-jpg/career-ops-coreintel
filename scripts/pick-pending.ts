// List the first N pending pipeline URLs so we can pick one to evaluate.
import postgres from 'postgres';
const url = process.env.DATABASE_URL_POOLER!;
const sql = postgres(url, { max: 1, prepare: false });

const rows = await sql<{ id: string; company: string; title: string; url: string }[]>`
  select id, company, title, url
  from pipeline_urls
  where status = 'pending'
  order by scanned_at desc
  limit 5`;

for (const r of rows) {
  console.log(`${r.id}\t${r.company ?? '?'}\t${r.title ?? '?'}\n  ${r.url}`);
}
await sql.end();
