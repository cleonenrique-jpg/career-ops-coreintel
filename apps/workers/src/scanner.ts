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
import { fetchJd, shutdownBrowser } from './lib/fetchJd.js';

// Opcional: fallback para ejecución standalone single-tenant. En modo
// multi-tenant el scheduler siempre pasa userId explícito.
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID;

// Filtros FALLBACK — se usan cuando el usuario no tiene titlePositive propio
// en portals_config. El wizard de onboarding siembra filtros por usuario;
// loadUserTitleFilter() los agrega por encima de estos defaults.
const TITLE_FILTER: TitleFilter = {
  positive: ['gerente', 'director', 'jefe', 'head of', 'country manager', 'vp', 'chief'],
  negative: [
    'junior', 'jr.', 'jr ', 'pasante', 'practicante', 'becario', 'intern',
    'asistente', 'auxiliar', 'analista', 'analyst',
    'ingeniero de software', 'software engineer', 'developer', 'developer ', 'frontend', 'backend',
    'devops', 'qa', 'tester', 'data scientist',
  ],
};

async function loadUserTitleFilter(userId: string): Promise<TitleFilter> {
  const rows = await db.select({
    positive: portalsConfig.titlePositive,
    negative: portalsConfig.titleNegative,
  }).from(portalsConfig).where(eq(portalsConfig.userId, userId));
  const positive = Array.from(new Set(rows.flatMap((r) => r.positive ?? [])));
  const negative = Array.from(new Set(rows.flatMap((r) => r.negative ?? [])));
  if (positive.length === 0) return TITLE_FILTER; // sin config propia → fallback global
  return { positive, negative: negative.length ? negative : TITLE_FILTER.negative };
}

const GEO_FILTER = {
  require_any: ['costa rica', 'san josé', 'san jose', 'heredia', 'alajuela', 'cartago', 'guanacaste', 'puntarenas', 'limón'],
  exclude_if_only: ['panama', 'guatemala', 'honduras', 'el salvador', 'nicaragua', 'mexico', 'colombia', 'argentina', 'brasil', 'brazil', 'chile', 'peru'],
};

// Liveness check: open each candidate URL and skip if classifyLiveness reports
// 'expired'. Toggle via SCAN_LIVENESS_CHECK env var (default: enabled).
// Concurrency is conservative because Playwright contexts share a Chromium process.
const LIVENESS_CHECK_ENABLED = (process.env.SCAN_LIVENESS_CHECK ?? 'true').toLowerCase() !== 'false';
const LIVENESS_CONCURRENCY = Number(process.env.SCAN_LIVENESS_CONCURRENCY ?? 3);

// Company-name normalization: strips common corporate suffixes so
// "Kimberly-Clark" and "Kimberly-Clark Corporation" collapse to the same key.
const CORPORATE_SUFFIXES = /\b(corporation|corporación|corp|inc|incorporated|ltd|limited|s\.?\s?a\.?(?:\s?de\s?c\.?v\.?)?|s\.?\s?l\.?|s\.?\s?r\.?\s?l\.?|llc|company|co|gmbh|ag|bv)\b/gi;

function normalizeText(s: string | null | undefined): string {
  if (!s) return '';
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')    // strip diacritics
    .replace(CORPORATE_SUFFIXES, ' ')   // strip corp/inc/sa/sl/etc.
    .replace(/[^a-z0-9]+/g, '-')        // non-alnum → hyphen
    .replace(/^-|-$/g, '')              // trim leading/trailing hyphens
    .replace(/-+/g, '-');               // collapse multi-hyphens
}

function companyTitleKey(company: string | null | undefined, title: string | null | undefined): string {
  return `${normalizeText(company)}::${normalizeText(title)}`;
}

/**
 * Builds the set of company+title keys already seen, so a role posted to multiple
 * portals (e.g. Kimberly-Clark on LinkedIn + Talent.com) is only ingested once.
 */
async function buildSeenCompanyRoles(userId: string): Promise<Set<string>> {
  const seen = new Set<string>();
  const scans = await db.select({ company: scanHistory.company, title: scanHistory.title }).from(scanHistory).where(eq(scanHistory.userId, userId));
  for (const r of scans) {
    const key = companyTitleKey(r.company, r.title);
    if (key !== '::') seen.add(key);
  }
  const pipeline = await db.select({ company: pipelineUrls.company, title: pipelineUrls.title }).from(pipelineUrls).where(eq(pipelineUrls.userId, userId));
  for (const r of pipeline) {
    const key = companyTitleKey(r.company, r.title);
    if (key !== '::') seen.add(key);
  }
  return seen;
}

interface LiveOffer { url: string; company: string | null; title: string | null; location: string | null; source: ScanSource }

/**
 * Filters candidate offers by visiting each URL and applying classifyLiveness.
 * Returns only the offers whose status is 'live' or 'uncertain' (we are lenient
 * with uncertain — it's better to let a possibly-dead URL through than to drop
 * a live one because the page lacked an obvious "apply" button).
 */
async function filterLiveOffers<T extends { url: string }>(offers: T[]): Promise<{ live: T[]; expired: number; errors: number }> {
  if (!LIVENESS_CHECK_ENABLED || offers.length === 0) {
    return { live: offers, expired: 0, errors: 0 };
  }

  const results: (T | null)[] = new Array(offers.length).fill(null);
  let expired = 0;
  let errors = 0;
  let i = 0;

  async function worker() {
    while (i < offers.length) {
      const idx = i++;
      const offer = offers[idx]!;
      try {
        const { liveness } = await fetchJd(offer.url);
        if (liveness.result === 'expired') {
          expired++;
          console.log(`[scanner:liveness] expired ${offer.url} — ${liveness.reason}`);
        } else {
          results[idx] = offer;
        }
      } catch (err) {
        errors++;
        // On fetch error, be lenient and KEEP the offer (next pass of liveness worker can re-evaluate)
        results[idx] = offer;
        console.warn(`[scanner:liveness] check failed for ${offer.url}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(LIVENESS_CONCURRENCY, offers.length) }, () => worker()));
  const live = results.filter((r): r is T => r !== null);
  return { live, expired, errors };
}

async function runApiScan(userId: string, titleFilter: TitleFilter): Promise<{ inserted: number; errors: number }> {
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

  const seenCompanyRoles = await buildSeenCompanyRoles(userId);

  const result = await runScan({
    companies,
    titleFilter,
    seenUrls,
    seenCompanyRoles,
  });

  console.log(`[scanner:api] scanned=${result.stats.scanned} found=${result.stats.totalFound} new=${result.newOffers.length} filtered=${result.stats.totalFiltered} dupes=${result.stats.totalDupes} errors=${result.errors.length}`);

  if (result.newOffers.length === 0) return { inserted: 0, errors: result.errors.length };

  // Liveness pre-filter: only insert offers that are still live.
  const { live: liveOffers, expired, errors: livenessErrors } = await filterLiveOffers(result.newOffers);
  if (LIVENESS_CHECK_ENABLED) {
    console.log(`[scanner:api] liveness: ${liveOffers.length} live, ${expired} expired filtered, ${livenessErrors} check errors`);
  }
  if (liveOffers.length === 0) return { inserted: 0, errors: result.errors.length + livenessErrors };

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const o of liveOffers) {
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
  return { inserted: liveOffers.length, errors: result.errors.length + livenessErrors };
}

async function runListingsScan(userId: string, titleFilter: TitleFilter): Promise<{ inserted: number; errors: number }> {
  const seenUrlsRows = await db.select({ url: scanHistory.url }).from(scanHistory).where(eq(scanHistory.userId, userId));
  const seenUrls = new Set(seenUrlsRows.map((r) => r.url));
  const pipelineRows = await db.select({ url: pipelineUrls.url }).from(pipelineUrls).where(eq(pipelineUrls.userId, userId));
  for (const r of pipelineRows) seenUrls.add(r.url);

  const filters: ScrapeFilters = {
    title: buildListingTitleFilter(titleFilter),
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

  // Dedup by company+title (catches same role posted to multiple portals,
  // e.g. Kimberly-Clark on LinkedIn AND Talent.com → only first one survives).
  const seenCompanyRoles = await buildSeenCompanyRoles(userId);
  const dedupedNew: typeof allNew = [];
  let dupesByCompanyRole = 0;
  for (const o of allNew) {
    const key = companyTitleKey(o.company, o.title);
    if (key === '::' || seenCompanyRoles.has(key)) {
      if (key !== '::') dupesByCompanyRole++;
      continue;
    }
    seenCompanyRoles.add(key); // dedup within this batch too
    dedupedNew.push(o);
  }
  if (dupesByCompanyRole > 0) {
    console.log(`[scanner:listings] dedup company+title: ${dupesByCompanyRole} duplicate roles filtered`);
  }
  if (dedupedNew.length === 0) return { inserted: 0, errors: totalErrors };

  // Liveness pre-filter — most important here: Playwright scrapers often surface
  // already-closed postings from listing pages (especially Procomer, Computrabajo).
  const { live: liveOffers, expired, errors: livenessErrors } = await filterLiveOffers(dedupedNew);
  if (LIVENESS_CHECK_ENABLED) {
    console.log(`[scanner:listings] liveness: ${liveOffers.length} live, ${expired} expired filtered, ${livenessErrors} check errors`);
  }
  if (liveOffers.length === 0) return { inserted: 0, errors: totalErrors + livenessErrors };

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const o of liveOffers) {
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
  return { inserted: liveOffers.length, errors: totalErrors + livenessErrors };
}

/**
 * Programmatic entrypoint — used by the scheduler worker and as the script main().
 * Returns inserted + error counts so callers can log/decide. Does NOT call
 * shutdownBrowser() so the scheduler can reuse the Playwright instance.
 */
export interface RunScannerOptions {
  userId?: string;
  apiOnly?: boolean;
  listingsOnly?: boolean;
}

export async function runScanner(opts: RunScannerOptions = {}): Promise<{ inserted: number; errors: number }> {
  const userId = opts.userId ?? DEFAULT_USER_ID;
  if (!userId) throw new Error('[scanner] userId required (pass opts.userId or set DEFAULT_USER_ID)');
  const userProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!userProfile) throw new Error(`[scanner] no profile for user ${userId}`);

  const titleFilter = await loadUserTitleFilter(userId);

  let inserted = 0;
  let errors = 0;

  if (!opts.listingsOnly) {
    const r = await runApiScan(userId, titleFilter);
    inserted += r.inserted; errors += r.errors;
  }
  if (!opts.apiOnly) {
    const r = await runListingsScan(userId, titleFilter);
    inserted += r.inserted; errors += r.errors;
  }

  console.log(`\n[scanner] DONE inserted=${inserted} errors=${errors}`);
  return { inserted, errors };
}

async function main() {
  const args = process.argv.slice(2);
  await runScanner({
    apiOnly: args.includes('--api-only'),
    listingsOnly: args.includes('--listings-only'),
  });
  await shutdownBrowser();
}

// Only run main() when invoked directly (node scanner.js / tsx scanner.ts),
// not when imported by another module (e.g. the scheduler).
const isMainEntry = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scanner.js') || process.argv[1]?.endsWith('scanner.ts');
if (isMainEntry) {
  main()
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[scanner] fatal:', err);
      await shutdownBrowser();
      process.exit(1);
    });
}
