// One-shot — re-enqueue the original 5 evaluations through the cloud
// pipeline so we can compare Gemini Flash output vs. the original Claude scores.

import postgres from 'postgres';

const url = process.env.DATABASE_URL_POOLER!;
if (!url) throw new Error('DATABASE_URL_POOLER required');
const USER_ID = process.env.DEFAULT_USER_ID;
if (!USER_ID) throw new Error('DEFAULT_USER_ID required');

const ORIGINALS = [
  { num: 1, url: 'https://cr.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-gerente-de-operaciones-en-cartago-3C79460F785E38F761373E686DCF3405', company: 'Quantum Lifecycle (GEEP)', title: 'Gerente de Operaciones' },
  { num: 2, url: 'https://cr.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-gerente-comercial-para-centro-de-contacto-en-san-jose-674A856BEC497BEE61373E686DCF3405', company: 'Netcom Business Contact Center', title: 'Gerente Comercial Centro de Contacto' },
  { num: 3, url: 'https://cr.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-gerente-de-retail-comercial-retail-en-goicoechea-F7893AFD0213CD6661373E686DCF3405', company: 'Distribuidora Universal de Alimentos', title: 'Gerente de Retail' },
  { num: 4, url: 'https://cr.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-director-de-zona-guanacaste-con-amplia-experiencia-en-liberia-152E27C2BA89D8AA61373E686DCF3405', company: 'Corporación Megasuper', title: 'Director de Zona Guanacaste' },
  { num: 5, url: 'https://cindejobs.com/en/fair/deloitte-us-costa-rica-offices/manager-growth-transformation-deloitte-us-costa-rica-office', company: 'Deloitte US Costa Rica', title: 'Manager, Growth & Transformation' },
];

const sql = postgres(url, { max: 1, prepare: false });

const ids: string[] = [];
for (const o of ORIGINALS) {
  // Upsert pipeline URL, reset to pending so the worker picks it up.
  const [row] = await sql<{ id: string }[]>`
    insert into pipeline_urls (user_id, url, company, title, status, source, scanned_at)
    values (${USER_ID}, ${o.url}, ${o.company}, ${o.title}, 'pending', 'manual', now())
    on conflict (user_id, url) do update set
      status = 'pending',
      processed_at = null,
      application_id = null,
      company = excluded.company,
      title = excluded.title
    returning id`;
  if (row) {
    ids.push(row.id);
    console.log(`✓ #${o.num} ${o.company} → pipeline_url ${row.id}`);
  }
}

console.log(`\n${ids.length} URLs ready to evaluate.`);
console.log('IDs:', JSON.stringify(ids));

await sql.end();
