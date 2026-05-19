import postgres from 'postgres';
const url = process.env.DATABASE_URL_POOLER!;
const sql = postgres(url, { max: 1, prepare: false });

const [app] = await sql<any[]>`
  select id, num, company, role, score::text, status, url, notes, created_at
  from applications order by created_at desc limit 1`;

console.log(`── #${app.num} ${app.company} — ${app.role} ──`);
console.log(`status=${app.status}  score=${app.score}  url=${app.url}`);
console.log(`notes: ${app.notes}`);

const [report] = await sql<any[]>`select content_md, verification from reports where application_id = ${app.id} order by generated_at desc limit 1`;
console.log(`\n── REPORT (verification=${report.verification}) ──\n`);
console.log(report.content_md);

const [run] = await sql<any[]>`select model, input_tokens, output_tokens, cost_usd::text, success from evaluation_runs where application_id is null and pipeline_url_id is not null order by created_at desc limit 1`;
console.log(`\n── COST ──`);
console.log(`model=${run?.model}  input=${run?.input_tokens} output=${run?.output_tokens}  cost=$${run?.cost_usd}  success=${run?.success}`);

await sql.end();
