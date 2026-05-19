// Quick audit of what source types are configured + which can actually be scanned.
import postgres from 'postgres';
const url = process.env.DATABASE_URL_POOLER!;
const sql = postgres(url, { max: 1, prepare: false });

console.log('── portals_config: by source ──');
const bySource = await sql<{ source: string; n: number; with_api: number; with_careers: number }[]>`
  select
    source::text,
    count(*)::int as n,
    count(*) filter (where api_url is not null and api_url <> '')::int as with_api,
    count(*) filter (where careers_url is not null and careers_url <> '')::int as with_careers
  from portals_config
  group by source order by n desc`;
for (const r of bySource) {
  console.log(`  ${r.source.padEnd(14)} count=${r.n}  api_url=${r.with_api}  careers_url=${r.with_careers}`);
}

console.log('\n── First 10 portals with API ──');
const withApi = await sql<{ company_name: string; api_url: string }[]>`
  select company_name, api_url from portals_config
  where api_url is not null and api_url <> ''
  order by company_name limit 10`;
for (const r of withApi) console.log(`  ${r.company_name}  →  ${r.api_url}`);

console.log('\n── Sample of careers_url (no API) ──');
const noApi = await sql<{ company_name: string; careers_url: string }[]>`
  select company_name, careers_url from portals_config
  where (api_url is null or api_url = '') and careers_url is not null and careers_url <> ''
  order by company_name limit 10`;
for (const r of noApi) console.log(`  ${r.company_name}  →  ${r.careers_url}`);

console.log('\n── pipeline_urls: by source ──');
const pipeBySource = await sql<{ source: string; n: number }[]>`
  select coalesce(source::text, 'null') as source, count(*)::int as n
  from pipeline_urls group by source order by n desc`;
for (const r of pipeBySource) console.log(`  ${r.source.padEnd(14)} ${r.n}`);

console.log('\n── pipeline_urls: by domain ──');
const byDomain = await sql<{ domain: string; n: number }[]>`
  select split_part(split_part(url, '://', 2), '/', 1) as domain, count(*)::int as n
  from pipeline_urls group by domain order by n desc limit 15`;
for (const r of byDomain) console.log(`  ${r.domain.padEnd(40)} ${r.n}`);

await sql.end();
