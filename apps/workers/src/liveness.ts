// Cron worker — re-checks pending pipeline_urls for liveness and marks
// expired ones as 'expired' so the UI does not waste time on dead postings.

import { db, pipelineUrls } from '@career-ops/db';
import { fetchJd, shutdownBrowser } from './lib/fetchJd.js';
import { and, eq } from 'drizzle-orm';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID;
if (!DEFAULT_USER_ID) throw new Error('DEFAULT_USER_ID required');

const BATCH_LIMIT = 30;

async function main() {
  const userId = DEFAULT_USER_ID!;
  const rows = await db.select().from(pipelineUrls)
    .where(and(eq(pipelineUrls.userId, userId), eq(pipelineUrls.status, 'pending')))
    .limit(BATCH_LIMIT);

  let expired = 0;
  for (const r of rows) {
    try {
      const { liveness } = await fetchJd(r.url);
      if (liveness.result === 'expired') {
        await db.update(pipelineUrls).set({ status: 'expired', processedAt: new Date() }).where(eq(pipelineUrls.id, r.id));
        expired++;
        console.log(`[liveness] expired ${r.url} — ${liveness.reason}`);
      }
    } catch (err) {
      console.warn(`[liveness] error on ${r.url}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[liveness] checked=${rows.length} expired=${expired}`);
  await shutdownBrowser();
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('[liveness] fatal:', err); process.exit(1); });
