import { detectApi } from './detect.js';
import { parseGreenhouse } from './sources/greenhouse.js';
import { parseAshby } from './sources/ashby.js';
import { parseLever } from './sources/lever.js';
import { buildTitleFilter, isWithinAge } from './filter.js';
import type { CompanyPortal, RawJob, ScannedJob, TitleFilter } from './types.js';

const FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_MAX_AGE_DAYS = 15;

const PARSERS = {
  greenhouse: parseGreenhouse,
  ashby: parseAshby,
  lever: parseLever,
} as const;

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface ScanOptions {
  companies: CompanyPortal[];
  titleFilter: TitleFilter;
  seenUrls: Set<string>;
  seenCompanyRoles: Set<string>;
  maxAgeDays?: number;
  concurrency?: number;
}

export interface ScanResult {
  newOffers: ScannedJob[];
  errors: { company: string; error: string }[];
  stats: {
    totalFound: number;
    totalFiltered: number;
    totalExpired: number;
    totalDupes: number;
    scanned: number;
    skipped: number;
  };
}

export async function runScan({
  companies, titleFilter, seenUrls, seenCompanyRoles,
  maxAgeDays = DEFAULT_MAX_AGE_DAYS, concurrency = DEFAULT_CONCURRENCY,
}: ScanOptions): Promise<ScanResult> {
  const titleOk = buildTitleFilter(titleFilter);

  const targets = companies
    .filter((c) => c.enabled !== false)
    .map((c) => ({ company: c, api: detectApi(c) }))
    .filter((t): t is { company: CompanyPortal; api: NonNullable<ReturnType<typeof detectApi>> } => t.api !== null);

  const skipped = companies.filter((c) => c.enabled !== false).length - targets.length;

  const stats = { totalFound: 0, totalFiltered: 0, totalExpired: 0, totalDupes: 0, scanned: targets.length, skipped };
  const newOffers: ScannedJob[] = [];
  const errors: { company: string; error: string }[] = [];

  const tasks = targets.map(({ company, api }) => async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const json = await fetchJson(api.url, controller.signal);
      const jobs = (PARSERS[api.type] as (j: unknown, c: string) => RawJob[])(json, company.name);
      stats.totalFound += jobs.length;

      for (const job of jobs) {
        if (!titleOk(job.title)) { stats.totalFiltered++; continue; }
        if (!isWithinAge(job.postedAt, maxAgeDays)) { stats.totalExpired++; continue; }
        if (seenUrls.has(job.url)) { stats.totalDupes++; continue; }
        const key = `${job.company.toLowerCase()}::${job.title.toLowerCase()}`;
        if (seenCompanyRoles.has(key)) { stats.totalDupes++; continue; }
        seenUrls.add(job.url);
        seenCompanyRoles.add(key);
        newOffers.push({ ...job, source: api.type });
      }
    } catch (err) {
      errors.push({ company: company.name, error: err instanceof Error ? err.message : String(err) });
    } finally {
      clearTimeout(timer);
    }
  });

  await parallelRun(tasks, concurrency);
  return { newOffers, errors, stats };
}

async function parallelRun<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results.push(await tasks[idx]!());
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}
