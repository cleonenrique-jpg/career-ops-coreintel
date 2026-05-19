import postgres from 'postgres';
const url = process.env.DATABASE_URL_POOLER!;
const sql = postgres(url, { max: 1, prepare: false });

const tables = await sql<{ table_name: string }[]>`
  select table_name from information_schema.tables where table_schema = 'pgboss' order by table_name`;
console.log('pgboss tables:', tables.map((t) => t.table_name).join(', '));

const jobs = await sql<any[]>`
  select id, name, state, retry_count, created_on, started_on, completed_on, output
  from pgboss.job
  where name in ('evaluate-pipeline-url', 'generate-pdf', 'generate-interview-prep')
  order by created_on desc
  limit 10`;
console.log('\nrecent jobs:');
for (const j of jobs) console.log(`  ${j.state.padEnd(12)} ${j.name}  id=${j.id}  retries=${j.retry_count}  ${j.completed_on ?? j.started_on ?? j.created_on}`);

await sql.end();
