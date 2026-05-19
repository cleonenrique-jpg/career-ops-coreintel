// Cron worker — combines two scanning strategies:
//
// 1. APIs (Greenhouse / Ashby / Lever) via @career-ops/scan-core: zero-token,
//    fast, reliable for tech companies that publish via these ATSs.
// 2. Playwright scrapers (Procomer / CINDE / LinkedIn / Talent.com / Computrabajo)
//    via @career-ops/scan-listings: covers the Costa Rica market where those
//    ATSs aren't used.
//
// Both write to pipeline_urls + scan_history with onConflictDoNothing for dedup.

import { eq } from 'drizzle-orm';
import {
  db, portalsConfig, pipelineUrls, scanHistory, profiles,
} from '@career-ops/db';
import { runScan, type CompanyPortal, type TitleFilter } from '@career-ops/scan-core';
import {
  ALL_PORTALS, buildTitleFilter as buildListingTitleFilter, buildGeoFilter,
  runListingScrape, type ScrapeFilters,
} from '@career-ops/scan-listings';
import type { ScanSource } from '@career-ops/shared';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID;
if (!DEFAULT_USER_ID) throw new Error('DEFAULT_USER_ID required for single-tenant scanner');

// Configurable filters — applied uniformly to both API and Playwright results.
// In a multi-user setup we'd read these per-user from profiles or portals_config;
// for now they live as constants matching the legacy portals.yml.
const TITLE_FILTER: TitleFilter = {
  positive: ['gerente', 'director', 'jefe', 'head of', 'country manager', 'vp', 'chief'],
  negative: [
    'junior', 'jr.', 'jr ', 'pasante', 'practicante', 'becario', 'intern',
    'asistente', 'auxiliar', 'analista', 'analyst',
    'ingeniero de software', 'software engineer', 'developer', 'developer ', 'frontend', 'backend',
    'devops', 'qa', 'tester', 'data scientist',
  ],
};

const GEO_FILTER = {
  require_any: ['costa rica', 'san josé', 'san jose', 'heredia', 'alajuela', 'cartago', 'guanacaste', 'puntarenas', 'limón'],
  exclude_if_only: ['panama', 'guatemala', 'honduras', 'el salvador', 'nicaragua', 'mexico', 'colombia', 'argentina', 'brasil', 'brazil', 'chile', 'peru'],
};

async function runApiScan(userId: string): Promise<{ inserted: number; errors: number }> {
  const portals = await db.select().from(portalsConfig).where(eq(portalsConfig.userId, userId));
  const companies: CompanyPortal[] = portals.map((p) => ({
    name: p.companyName ?? p.companySlug ?? 'unknown',
    enabled: p.enabled,
    api: p.apiUrl ?? undefined,
    careersUrl: p.careersUrl ?? undefined,
  }));

  const seenUrlsRows = await db.select({ url: scanHistory.url }).from(scanHistory).where(eq(scanHistory.userId, userId));
  const seenUrls = new Set(seenUrlsRows.map((r) => r.url));
  const pipelineRows = await db.select({ url: pipelineUrls.url }).from(pipelineUrls).where(eq(pipelineUrls.userId, userId));
  for (const r of pipelineRows) seenUrls.add(r.url);

  const result = await runScan({
    companies,
    titleFilter: TITLE_FILTER,
    seenUrls,
    seenCompanyRoles: new Set<string>(),
  });

  console.log(`[scanner:api] scanned=${result.stats.scanned} found=${result.stats.totalFound} new=${result.newOffers.length} filtered=${result.stats.totalFiltered} dupes=${result.stats.totalDupes} errors=${result.errors.length}`);

  if (result.newOffers.length === 0) return { inserted: 0, errors: result.errors.length };

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const o of result.newOffers) {
      await tx.insert(scanHistory).values({
        userId, url: o.url, company: o.company, title: o.title,
        location: o.location, source: o.source, firstSeenAt: now,
      }).onConflictDoNothing();
      await tx.insert(pipelineUrls).values({
        userId, url: o.url, company: o.company, title: o.title,
        status: 'pending', source: o.source, scannedAt: now,
      }).onConflictDoNothing();
    }
  });
  for (const e of result.errors) console.error(`[scanner:api] ${e.company}: ${e.error}`);
  return { inserted: result.newOffers.length, errors: result.errors.length };
}

async function runListingsScan(userId: string): Promise<{ inserted: number; errors: number }> {
  const seenUrlsRows = await db.select({ url: scanHistory.url }).from(scanHistory).where(eq(scanHistory.userId, userId));
  const seenUrls = new Set(seenUrlsRows.map((r) => r.url));
  const pipelineRows = await db.select({ url: pipelineUrls.url }).from(pipelineUrls).where(eq(pipelineUrls.userId, userId));
  for (const r of pipelineRows) seenUrls.add(r.url);

  const filters: ScrapeFilters = {
    title: buildListingTitleFilter(TITLE_FILTER),
    geo: buildGeoFilter(GEO_FILTER),
  };

  const results = await runListingScrape({
    portals: ALL_PORTALS,
    filters,
    seenUrls,
    env: process.env,
  });

  const allNew = results.flatMap((r) => r.newOffers.map((o) => ({ ...o, source: r.source as ScanSource })));
  const totalErrors = results.reduce((sum, r) => sum + r.stats.errors, 0);

  console.log(`[scanner:listings] total_new=${allNew.length} errors=${totalErrors}`);

  if (allNew.length === 0) return { inserted: 0, errors: totalErrors };

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const o of allNew) {
      await tx.insert(scanHistory).values({
        userId, url: o.url, company: o.company || null, title: o.title || null,
        location: o.location || null, source: o.source, firstSeenAt: now,
      }).onConflictDoNothing();
      await tx.insert(pipelineUrls).values({
        userId, url: o.url, company: o.company || null, title: o.title || null,
        status: 'pending', source: o.source, scannedAt: now,
      }).onConflictDoNothing();
    }
  });
  return { inserted: allNew.length, errors: totalErrors };
}

async function main() {
  const userId = DEFAULT_USER_ID!;
  const userProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!userProfile) {
    console.error(`[scanner] no profile for user ${userId}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const onlyApi = args.includes('--api-only');
  const onlyListings = args.includes('--listings-only');

  let inserted = 0;
  let errors = 0;

  if (!onlyListings) {
    const r = await runApiScan(userId);
    inserted += r.inserted; errors += r.errors;
  }
  if (!onlyApi) {
    const r = await runListingsScan(userId);
    inserted += r.inserted; errors += r.errors;
  }

  console.log(`\n[scanner] DONE inserted=${inserted} errors=${errors}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('[scanner] fatal:', err); process.exit(1); });
