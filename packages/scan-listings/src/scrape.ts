import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { PortalConfig, PortalRunResult, RawCandidate, ScrapeFilters } from './types.js';

const PAGE_TIMEOUT_MS = 20_000;
const HYDRATE_WAIT_MS = 3000;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

export interface ScrapeOptions {
  portals: PortalConfig[];
  filters: ScrapeFilters;
  seenUrls: Set<string>;
  env: Record<string, string | undefined>;
  /** Roles objetivo del usuario. Cada portal con `buildUrls` los usa para armar
   *  sus URLs de búsqueda. Vacío → cada portal cae a sus keywords default. */
  queries?: string[];
}

async function processCandidates(
  candidates: RawCandidate[],
  portal: PortalConfig,
  filters: ScrapeFilters,
  seenUrls: Set<string>,
  ctx: BrowserContext,
  result: PortalRunResult,
) {
  result.stats.found += candidates.length;
  for (const c of candidates) {
    if (!c.url) continue;
    if (seenUrls.has(c.url)) {
      result.stats.skipped_dup++;
      continue;
    }
    seenUrls.add(c.url);
    if (!filters.title(c.title)) { result.stats.skipped_title++; continue; }
    if (!filters.geo(c)) { result.stats.skipped_geo++; continue; }

    let offer: RawCandidate = { ...c };
    if (portal.enricher) {
      try { offer = await portal.enricher(ctx, offer); } catch { /* keep original */ }
    }
    result.stats.kept++;
    result.newOffers.push(offer);
  }
}

async function scrapePortal(
  browser: Browser,
  portal: PortalConfig,
  filters: ScrapeFilters,
  seenUrls: Set<string>,
  env: Record<string, string | undefined>,
  queries: string[],
): Promise<PortalRunResult> {
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const result: PortalRunResult = {
    portal: portal.name,
    source: portal.source,
    stats: { found: 0, kept: 0, skipped_title: 0, skipped_geo: 0, skipped_dup: 0, errors: 0 },
    newOffers: [],
  };

  // Branch 1: custom fetcher (auth + API)
  if (portal.fetcher) {
    const missing = (portal.requiresEnv ?? []).filter((k) => !env[k]);
    if (missing.length) {
      console.log(`  ✗ ${portal.name} missing env: ${missing.join(', ')} — skipping`);
      result.stats.errors++;
    } else {
      try {
        const candidates = await portal.fetcher(context, env);
        await processCandidates(candidates, portal, filters, seenUrls, context, result);
      } catch (err) {
        result.stats.errors++;
        console.log(`    ✗ ${portal.name}: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
      }
    }
    await context.close();
    return result;
  }

  // Branch 2: URL-based scraping with pageExtractor.
  // buildUrls(queries) tiene prioridad; si no, usa las urls estáticas.
  const urls = portal.buildUrls ? portal.buildUrls(queries) : (portal.urls ?? []);
  if (!portal.pageExtractor || urls.length === 0) {
    await context.close();
    return result;
  }
  const page = await context.newPage();
  page.setDefaultTimeout(PAGE_TIMEOUT_MS);
  for (const url of urls) {
    try {
      console.log(`  → ${portal.name}: ${url}`);
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
      const status = resp?.status() ?? 0;
      if (status >= 400) {
        result.stats.errors++;
        console.log(`    ✗ HTTP ${status}`);
        continue;
      }
      await page.waitForTimeout(HYDRATE_WAIT_MS);
      const candidates = await page.evaluate(portal.pageExtractor);
      await processCandidates(candidates, portal, filters, seenUrls, context, result);
    } catch (err) {
      result.stats.errors++;
      console.log(`    ✗ ${err instanceof Error ? err.message.split('\n')[0] : err}`);
    }
  }
  await context.close();
  return result;
}

export async function runListingScrape(opts: ScrapeOptions): Promise<PortalRunResult[]> {
  const browser = await chromium.launch({ headless: true });
  const results: PortalRunResult[] = [];
  try {
    // Sequential by design — multiple Playwright pages in parallel are flaky.
    for (const portal of opts.portals) {
      console.log(`▸ ${portal.name}`);
      const r = await scrapePortal(browser, portal, opts.filters, opts.seenUrls, opts.env, opts.queries ?? []);
      results.push(r);
      console.log(`  found=${r.stats.found} kept=${r.stats.kept} title=${r.stats.skipped_title} geo=${r.stats.skipped_geo} dup=${r.stats.skipped_dup} err=${r.stats.errors}`);
    }
  } finally {
    await browser.close();
  }
  return results;
}
