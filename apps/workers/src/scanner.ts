// Cron worker — polls Greenhouse/Ashby/Lever via @career-ops/scan-core,
// dedupes against scan_history + pipeline_urls, inserts new offers.

import { db, portalsConfig, pipelineUrls, scanHistory, profiles } from '@career-ops/db';
import { runScan, type CompanyPortal, type TitleFilter } from '@career-ops/scan-core';
import { eq, sql } from 'drizzle-orm';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID;
if (!DEFAULT_USER_ID) throw new Error('DEFAULT_USER_ID required for single-tenant scanner');

async function main() {
  const userId = DEFAULT_USER_ID!;

  const userProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!userProfile) {
    console.error(`[scanner] no profile for user ${userId}`);
    process.exit(1);
  }

  const portals = await db.select().from(portalsConfig).where(eq(portalsConfig.userId, userId));

  const companies: CompanyPortal[] = portals.map((p) => ({
    name: p.companyName ?? p.companySlug ?? 'unknown',
    enabled: p.enabled,
    api: p.apiUrl ?? undefined,
    careersUrl: p.careersUrl ?? undefined,
  }));

  // Merge per-portal positive/negative title filters into one global filter.
  // (Could be moved to per-portal scanning if precision matters more than speed.)
  const titleFilter: TitleFilter = {
    positive: Array.from(new Set(portals.flatMap((p) => p.titlePositive ?? []))),
    negative: Array.from(new Set(portals.flatMap((p) => p.titleNegative ?? []))),
  };

  const seenUrlsRows = await db.select({ url: scanHistory.url }).from(scanHistory).where(eq(scanHistory.userId, userId));
  const seenUrls = new Set(seenUrlsRows.map((r) => r.url));

  const pipelineRows = await db.select({ url: pipelineUrls.url }).from(pipelineUrls).where(eq(pipelineUrls.userId, userId));
  for (const r of pipelineRows) seenUrls.add(r.url);

  const seenCompanyRoles = new Set<string>();

  const result = await runScan({ companies, titleFilter, seenUrls, seenCompanyRoles });

  console.log(`[scanner] scanned=${result.stats.scanned} found=${result.stats.totalFound} new=${result.newOffers.length} filtered=${result.stats.totalFiltered} dupes=${result.stats.totalDupes} errors=${result.errors.length}`);

  if (result.newOffers.length > 0) {
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const o of result.newOffers) {
        await tx.insert(scanHistory).values({
          userId,
          url: o.url,
          company: o.company,
          title: o.title,
          location: o.location,
          source: o.source,
          firstSeenAt: now,
        }).onConflictDoNothing();

        await tx.insert(pipelineUrls).values({
          userId,
          url: o.url,
          company: o.company,
          title: o.title,
          status: 'pending',
          source: o.source,
          scannedAt: now,
        }).onConflictDoNothing();
      }
    });
    console.log(`[scanner] inserted ${result.newOffers.length} new offers`);
  }

  for (const e of result.errors) console.error(`[scanner] ${e.company}: ${e.error}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('[scanner] fatal:', err); process.exit(1); });
