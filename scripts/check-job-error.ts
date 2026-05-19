import postgres from 'postgres';
const url = process.env.DATABASE_URL_POOLER!;
const sql = postgres(url, { max: 1, prepare: false });

const jobs = await sql<any[]>`
  select id, state, output, retry_count
  from pgboss.job
  where name = 'evaluate-pipeline-url'
  order by created_on desc limit 3`;
for (const j of jobs) {
  console.log(`\n── ${j.id} (${j.state}, retries=${j.retry_count}) ──`);
  console.log(JSON.stringify(j.output, null, 2));
}

await sql.end();
