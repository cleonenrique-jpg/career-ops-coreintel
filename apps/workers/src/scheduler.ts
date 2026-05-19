// Long-lived scheduler — uses node-cron to trigger periodic scan + eval cycles.
// Scan cadence and auto-eval are configurable via env vars:
//   SCAN_CRON           default: '0 */4 * * *'   (every 4 hours)
//   FOLLOWUP_CHECK_CRON default: '0 13 * * *'    (13:00 UTC = 7:00 CR daily)
//   AUTO_EVAL_NEW       default: 'true'          (queue evaluator for new pending after scan)
//
// On Railway / production, set these via the environment. On macOS dev,
// run `pnpm --filter @career-ops/workers dev:scheduler`.

import cron from 'node-cron';
import { eq, and, isNull } from 'drizzle-orm';
import { db, pipelineUrls } from '@career-ops/db';
import { boss, QUEUES, type EvaluateJobData } from './lib/queue.js';
import { runScanner as runScannerInProcess } from './scanner.js';
import { shutdownBrowser } from './lib/fetchJd.js';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID;
if (!DEFAULT_USER_ID) throw new Error('DEFAULT_USER_ID required for scheduler');

const SCAN_CRON = process.env.SCAN_CRON ?? '0 */4 * * *';
const FOLLOWUP_CHECK_CRON = process.env.FOLLOWUP_CHECK_CRON ?? '0 13 * * *';
const AUTO_EVAL_NEW = (process.env.AUTO_EVAL_NEW ?? 'true').toLowerCase() !== 'false';

let scanRunning = false;

async function runScanCycle(): Promise<void> {
  if (scanRunning) {
    console.log('[scheduler] scan already in progress, skipping this tick');
    return;
  }
  scanRunning = true;
  const startedAt = Date.now();
  console.log(`[scheduler] scan starting (${new Date().toISOString()})`);

  try {
    const result = await runScannerInProcess({ userId: DEFAULT_USER_ID! });
    console.log(`[scheduler] scan done in ${Math.round((Date.now() - startedAt) / 1000)}s — inserted=${result.inserted} errors=${result.errors}`);
  } catch (err) {
    console.error('[scheduler] scan failed:', err instanceof Error ? err.message : err);
  } finally {
    scanRunning = false;
  }

  if (AUTO_EVAL_NEW) {
    await autoEvalNewPending();
  }
}

async function autoEvalNewPending(): Promise<void> {
  const userId = DEFAULT_USER_ID!;
  // Pending pipeline_urls that don't have an application yet (i.e. haven't been evaluated).
  const newOnes = await db.select({ id: pipelineUrls.id }).from(pipelineUrls)
    .where(and(
      eq(pipelineUrls.userId, userId),
      eq(pipelineUrls.status, 'pending'),
      isNull(pipelineUrls.applicationId),
    ));

  if (newOnes.length === 0) {
    console.log('[scheduler] no new pending entries to evaluate');
    return;
  }

  await boss.start();
  await boss.createQueue(QUEUES.evaluate).catch(() => {});
  const jobs = await Promise.all(newOnes.map((r) =>
    boss.send(QUEUES.evaluate, { userId, pipelineUrlId: r.id } satisfies EvaluateJobData),
  ));
  console.log(`[scheduler] enqueued ${jobs.length} new entries for evaluation`);
}

async function checkFollowUps(): Promise<void> {
  // Simple log-only check; the dashboard widget is the actual surface for the user.
  // We could also push notifications here in the future.
  console.log(`[scheduler] follow-up check tick (${new Date().toISOString()})`);
  // Detailed detection logic lives in the API (/api/follow-ups) so the dashboard
  // and this scheduled task share the same source of truth.
}

async function main() {
  // Validate cron expressions early — fail fast if env vars are malformed.
  if (!cron.validate(SCAN_CRON)) throw new Error(`SCAN_CRON invalid: ${SCAN_CRON}`);
  if (!cron.validate(FOLLOWUP_CHECK_CRON)) throw new Error(`FOLLOWUP_CHECK_CRON invalid: ${FOLLOWUP_CHECK_CRON}`);

  console.log(`[scheduler] starting (scan="${SCAN_CRON}", follow-up="${FOLLOWUP_CHECK_CRON}", auto-eval=${AUTO_EVAL_NEW})`);

  cron.schedule(SCAN_CRON, () => { runScanCycle().catch((err) => console.error('[scheduler] scan err:', err)); });
  cron.schedule(FOLLOWUP_CHECK_CRON, () => { checkFollowUps().catch((err) => console.error('[scheduler] follow-up err:', err)); });

  // Trigger one scan immediately on startup so a fresh boot doesn't wait up to N hours.
  if ((process.env.SCAN_ON_STARTUP ?? 'true').toLowerCase() !== 'false') {
    console.log('[scheduler] running initial scan on startup');
    runScanCycle().catch((err) => console.error('[scheduler] initial scan err:', err));
  }

  // Keep process alive (node-cron jobs hold the event loop, but explicit forever-await is robust).
  await new Promise(() => {});
}

process.on('SIGTERM', async () => { await boss.stop().catch(() => {}); await shutdownBrowser().catch(() => {}); process.exit(0); });
process.on('SIGINT',  async () => { await boss.stop().catch(() => {}); await shutdownBrowser().catch(() => {}); process.exit(0); });

main().catch((err) => { console.error('[scheduler] fatal:', err); process.exit(1); });
