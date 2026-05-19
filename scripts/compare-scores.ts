// Compare Claude's original scores (#1–#5, migrated from data/applications.md)
// against Gemini's re-evaluations (created by the evaluator from the same URLs).

import postgres from 'postgres';
const url = process.env.DATABASE_URL_POOLER!;
const sql = postgres(url, { max: 1, prepare: false });

const claude = await sql<{ num: number; company: string; role: string; score: string; status: string }[]>`
  select num, company, role, score::text, status
  from applications
  where num between 1 and 5
  order by num`;

const gemini = await sql<{ num: number; company: string; role: string; score: string; status: string; created_at: Date }[]>`
  select num, company, role, score::text, status, created_at
  from applications
  where num > 5
  order by num`;

console.log('num | company                            | role                                 | Claude → Gemini | Δ    | Claude/Gemini decision');
console.log('----+------------------------------------+--------------------------------------+-----------------+------+-----------------------');

for (const c of claude) {
  const g = gemini.find((x) => x.company === c.company && x.role === c.role);
  const claudeS = Number(c.score);
  const geminiS = g ? Number(g.score) : null;
  const delta = geminiS != null ? (geminiS - claudeS).toFixed(1) : '—';
  const claudeDec = c.status;
  const geminiDec = g?.status ?? '—';
  console.log(
    `${String(c.num).padStart(3)} | ${c.company.padEnd(34).slice(0, 34)} | ${c.role.padEnd(36).slice(0, 36)} | ${claudeS.toFixed(1)}    →    ${geminiS != null ? geminiS.toFixed(1) : '—'}   | ${delta.padStart(4)} | ${claudeDec} / ${geminiDec}`,
  );
}

const enqueued = await sql<{ status: string; n: number }[]>`
  select status, count(*)::int as n
  from pipeline_urls
  where company in (${sql(claude.map((c) => c.company))})
  group by status`;
console.log('\nPipeline status for the 5 originals:', enqueued);

await sql.end();
