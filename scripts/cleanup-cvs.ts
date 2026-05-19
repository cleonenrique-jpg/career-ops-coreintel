import postgres from 'postgres';
const url = process.env.DATABASE_URL_POOLER!;
const sql = postgres(url, { max: 1, prepare: false });

// Keep only the most recent active CV per user. Delete inactive duplicates.
const deleted = await sql`
  delete from cvs
  where is_active = false
  returning id`;
console.log(`Deleted ${deleted.length} inactive CV rows.`);

const remaining = await sql<{ n: number }[]>`select count(*)::int as n from cvs`;
console.log(`Remaining cvs: ${remaining[0]?.n}`);
await sql.end();
