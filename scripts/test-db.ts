import postgres from 'postgres';

const url = process.env.DATABASE_URL_POOLER ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_POOLER required');

console.log('connecting to:', url.replace(/:[^:@]+@/, ':***@'));
const sql = postgres(url, { max: 1, prepare: false });

const rows = await sql<{ n: number }[]>`select count(*)::int as n from profiles`;
console.log('profiles count:', rows[0]?.n);

const tables = await sql<{ table_name: string }[]>`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name`;
console.log('public tables:', tables.map((t) => t.table_name).join(', '));

await sql.end();
