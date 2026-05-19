// One-shot importer from a legacy career-ops repo (markdown + YAML) into Supabase.
//
// Usage (from career-ops-cloud root):
//   LEGACY_REPO_PATH=../career-ops DEFAULT_USER_ID=<uuid> tsx scripts/migrate-from-md.ts
//
// Idempotent — re-running is safe. Uses unique keys (user_id, num) and (user_id, url).

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import yaml from 'yaml';
import {
  db, profiles, cvs, applications, pipelineUrls, scanHistory,
  reports, portalsConfig, storyBank,
} from '@career-ops/db';
import { normalizeStatus, type ApplicationStatus, type ScanSource } from '@career-ops/shared';
import { and, eq } from 'drizzle-orm';

const LEGACY = process.env.LEGACY_REPO_PATH ?? '../career-ops';
const USER_ID = process.env.DEFAULT_USER_ID;
if (!USER_ID) throw new Error('DEFAULT_USER_ID required');

function p(...parts: string[]) { return join(LEGACY, ...parts); }

async function readMaybe(path: string): Promise<string | null> {
  try { return await readFile(path, 'utf-8'); } catch { return null; }
}

// ── Profile ──────────────────────────────────────────────────────────

async function migrateProfile() {
  const yml = await readMaybe(p('config/profile.yml'));
  if (!yml) { console.log('[migrate] no profile.yml — skipping'); return; }
  const parsed = yaml.parse(yml) as {
    candidate?: Record<string, string>;
    target_roles?: { archetypes?: Array<{ name: string; level: string; fit: string }> };
    narrative?: Record<string, unknown>;
    compensation?: { target_range?: string; minimum?: string; currency?: string };
    location?: Record<string, string>;
    language?: { modes_dir?: string };
  };

  const c = parsed.candidate ?? {};
  const arche = parsed.target_roles?.archetypes ?? [];
  const compMin = parseMoney(parsed.compensation?.minimum);
  const compMax = parseMoney(parsed.compensation?.target_range);
  const lang = inferLanguage(parsed.language?.modes_dir);

  const narrativeText = [
    parsed.narrative?.headline ?? '',
    parsed.narrative?.exit_story ?? '',
    Array.isArray(parsed.narrative?.superpowers) ? (parsed.narrative?.superpowers as string[]).map((s) => `- ${s}`).join('\n') : '',
  ].filter(Boolean).join('\n\n');

  const superpowers = Array.isArray(parsed.narrative?.superpowers) ? (parsed.narrative?.superpowers as string[]) : [];

  await db.insert(profiles).values({
    userId: USER_ID!,
    fullName: c.full_name ?? 'Unknown',
    email: c.email ?? 'unknown@example.com',
    phone: c.phone ?? null,
    location: c.location ?? null,
    timezone: parsed.location?.timezone ?? null,
    linkedin: c.linkedin ?? null,
    portfolioUrl: c.portfolio_url ?? null,
    github: c.github ?? null,
    archetypes: arche.map((a) => ({ name: a.name, level: a.level, fit: a.fit as 'primary' | 'secondary' | 'adjacent' })),
    narrative: narrativeText || null,
    superpowers,
    compTargetMin: compMin,
    compTargetMax: compMax,
    compCurrency: parsed.compensation?.currency ?? 'USD',
    languageMode: lang,
  }).onConflictDoUpdate({
    target: profiles.userId,
    set: {
      fullName: c.full_name ?? 'Unknown',
      email: c.email ?? 'unknown@example.com',
      phone: c.phone ?? null,
      location: c.location ?? null,
      narrative: narrativeText || null,
      superpowers,
      archetypes: arche.map((a) => ({ name: a.name, level: a.level, fit: a.fit as 'primary' | 'secondary' | 'adjacent' })),
      compTargetMin: compMin,
      compTargetMax: compMax,
      languageMode: lang,
    },
  });
  console.log('[migrate] profile upserted');
}

function parseMoney(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d[\d,.]*)/);
  if (!m) return null;
  return Math.round(Number(m[1]!.replace(/,/g, '')));
}

function inferLanguage(dir: string | undefined): 'en' | 'es' | 'de' | 'fr' | 'ja' {
  if (!dir) return 'es';
  if (dir.includes('/de')) return 'de';
  if (dir.includes('/fr')) return 'fr';
  if (dir.includes('/ja')) return 'ja';
  if (dir.includes('/es')) return 'es';
  return 'en';
}

// ── CV ──────────────────────────────────────────────────────────────

async function migrateCv() {
  const md = await readMaybe(p('cv.md'));
  if (!md) { console.log('[migrate] no cv.md — skipping'); return; }
  // Idempotent: skip if active CV already matches the file content.
  const existing = await db.select().from(cvs).where(and(eq(cvs.userId, USER_ID!), eq(cvs.isActive, true)));
  if (existing[0]?.contentMd === md) { console.log('[migrate] cv unchanged — skipping'); return; }
  await db.update(cvs).set({ isActive: false }).where(eq(cvs.userId, USER_ID!));
  await db.insert(cvs).values({ userId: USER_ID!, contentMd: md, isActive: true, version: 1 });
  console.log('[migrate] cv inserted');
}

// ── Applications ────────────────────────────────────────────────────

async function migrateApplications() {
  const md = await readMaybe(p('data/applications.md'));
  if (!md) { console.log('[migrate] no applications.md — skipping'); return; }

  const rows = parseApplicationsTable(md);
  let count = 0;
  for (const r of rows) {
    const status = normalizeStatus(r.status) ?? 'Evaluated';
    await db.insert(applications).values({
      userId: USER_ID!,
      num: r.num,
      date: r.date,
      company: r.company,
      role: r.role,
      score: r.score?.toFixed(1) ?? null,
      status,
      notes: r.notes || null,
    }).onConflictDoUpdate({
      target: [applications.userId, applications.num],
      set: { date: r.date, company: r.company, role: r.role, score: r.score?.toFixed(1) ?? null, status, notes: r.notes || null },
    });
    count++;
  }
  console.log(`[migrate] applications upserted: ${count}`);
}

function parseApplicationsTable(md: string): Array<{ num: number; date: string; company: string; role: string; score: number | null; status: string; notes: string }> {
  const out = [] as ReturnType<typeof parseApplicationsTable>;
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue;
    if (line.includes('---')) continue;
    if (line.includes('Company') && line.includes('Role')) continue;
    const cells = line.split('|').slice(1, -1).map((s) => s.trim());
    if (cells.length < 6) continue;
    const num = Number(cells[0]);
    if (!Number.isFinite(num)) continue;
    const scoreCell = cells[4] ?? '';
    const m = scoreCell.match(/(\d+(?:\.\d+)?)/);
    const score = m ? Number(m[1]) : null;
    out.push({
      num,
      date: cells[1] ?? '',
      company: cells[2] ?? '',
      role: cells[3] ?? '',
      score,
      status: cells[5] ?? 'Evaluated',
      notes: cells[8] ?? '',
    });
  }
  return out;
}

// ── Pipeline URLs ───────────────────────────────────────────────────

async function migratePipeline() {
  const md = await readMaybe(p('data/pipeline.md'));
  if (!md) { console.log('[migrate] no pipeline.md — skipping'); return; }

  let inserted = 0;
  for (const line of md.split('\n')) {
    const m = line.match(/^- \[( |x)\]\s+(https?:\/\/\S+)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)(?:\s*\|\s*(.*))?$/);
    if (!m) continue;
    const checked = m[1] === 'x';
    const url = m[2]!;
    const company = (m[3] ?? '').trim() || null;
    const title = (m[4] ?? '').trim() || null;
    const tail = (m[5] ?? '').toLowerCase();

    let status: 'pending' | 'processed' | 'discarded' | 'expired' = 'pending';
    if (checked && tail.includes('caducada')) status = 'expired';
    else if (checked) status = 'processed';

    await db.insert(pipelineUrls).values({
      userId: USER_ID!,
      url,
      company,
      title,
      status,
      source: 'manual',
      scannedAt: new Date(),
    }).onConflictDoNothing();
    inserted++;
  }
  console.log(`[migrate] pipeline_urls processed: ${inserted}`);
}

// ── Scan history ────────────────────────────────────────────────────

async function migrateScanHistory() {
  const tsv = await readMaybe(p('data/scan-history.tsv'));
  if (!tsv) { console.log('[migrate] no scan-history.tsv — skipping'); return; }

  const lines = tsv.split('\n').slice(1); // skip header
  const rows = [] as Array<{
    userId: string; url: string; company: string | null; title: string | null;
    source: ScanSource; firstSeenAt: Date;
  }>;

  for (const line of lines) {
    if (!line.trim()) continue;
    const [url, firstSeen, source, title, company] = line.split('\t');
    if (!url) continue;
    rows.push({
      userId: USER_ID!,
      url,
      company: company || null,
      title: title || null,
      source: inferScanSource(source ?? ''),
      firstSeenAt: parseDate(firstSeen) ?? new Date(),
    });
  }

  // Batch insert in chunks to keep statement size sane on the pooler.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await db.insert(scanHistory).values(chunk).onConflictDoNothing();
    inserted += chunk.length;
    console.log(`[migrate] scan_history progress: ${inserted}/${rows.length}`);
  }
  console.log(`[migrate] scan_history rows attempted: ${inserted}`);
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inferScanSource(raw: string): ScanSource {
  const lower = raw.toLowerCase();
  if (lower.includes('greenhouse')) return 'greenhouse';
  if (lower.includes('ashby')) return 'ashby';
  if (lower.includes('lever')) return 'lever';
  if (lower.includes('linkedin')) return 'linkedin';
  if (lower.includes('computrabajo')) return 'computrabajo';
  if (lower.includes('talent')) return 'talent';
  if (lower.includes('tecoloco')) return 'tecoloco';
  return 'manual';
}

// ── Reports ─────────────────────────────────────────────────────────

async function migrateReports() {
  const dir = p('reports');
  if (!existsSync(dir)) { console.log('[migrate] no reports/ — skipping'); return; }
  const files = (await readdir(dir)).filter((f) => /^\d{3}-/.test(f) && f.endsWith('.md'));

  let inserted = 0;
  for (const f of files) {
    const num = Number(f.slice(0, 3));
    const contentMd = await readFile(join(dir, f), 'utf-8');
    const [app] = await db.select().from(applications)
      .where(and(eq(applications.userId, USER_ID!), eq(applications.num, num)));
    if (!app) {
      console.warn(`[migrate] skipping ${f} — no matching application num=${num}`);
      continue;
    }
    // Skip if a report already exists.
    const existing = await db.select().from(reports)
      .where(and(eq(reports.applicationId, app.id), eq(reports.num, num)));
    if (existing.length > 0) continue;

    await db.insert(reports).values({
      userId: USER_ID!,
      applicationId: app.id,
      num,
      contentMd,
      verification: 'uncertain',
    });
    inserted++;
  }
  console.log(`[migrate] reports inserted: ${inserted}`);
}

// ── Portals ─────────────────────────────────────────────────────────

async function migratePortals() {
  const yml = await readMaybe(p('portals.yml'));
  if (!yml) { console.log('[migrate] no portals.yml — skipping'); return; }
  const parsed = yaml.parse(yml) as {
    tracked_companies?: Array<{ name: string; api?: string; careers_url?: string; enabled?: boolean }>;
    title_filter?: { positive?: string[]; negative?: string[] };
    queries?: Record<string, string[]>;
  };

  const positive = parsed.title_filter?.positive ?? [];
  const negative = parsed.title_filter?.negative ?? [];

  for (const company of parsed.tracked_companies ?? []) {
    const source: ScanSource = company.api?.includes('greenhouse') ? 'greenhouse'
      : company.careers_url?.includes('ashby') ? 'ashby'
      : company.careers_url?.includes('lever') ? 'lever'
      : 'manual';

    const slug = company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Idempotent: delete-then-insert per (user_id, source, company_slug) tuple.
    await db.delete(portalsConfig).where(
      and(eq(portalsConfig.userId, USER_ID!), eq(portalsConfig.source, source), eq(portalsConfig.companySlug, slug)),
    );
    await db.insert(portalsConfig).values({
      userId: USER_ID!,
      source,
      companySlug: slug,
      companyName: company.name,
      apiUrl: company.api ?? null,
      careersUrl: company.careers_url ?? null,
      queries: [],
      titlePositive: positive,
      titleNegative: negative,
      enabled: company.enabled !== false,
    });
  }
  console.log(`[migrate] portals_config rows: ${(parsed.tracked_companies ?? []).length}`);
}

// ── Story bank ──────────────────────────────────────────────────────

async function migrateStoryBank() {
  const md = await readMaybe(p('interview-prep/story-bank.md'));
  if (!md) { console.log('[migrate] no story-bank.md — skipping'); return; }
  // Stories are loosely structured; persist the full markdown as a single "raw" story
  // so the UI can show it. Future: parse STAR sections individually.
  await db.insert(storyBank).values({
    userId: USER_ID!,
    title: 'Imported story bank',
    situation: null, task: null, action: null, result: null, reflection: md,
    tags: ['imported'],
  });
  console.log('[migrate] story bank imported as single record');
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`[migrate] LEGACY_REPO_PATH=${LEGACY}`);
  console.log(`[migrate] DEFAULT_USER_ID=${USER_ID}`);
  await migrateProfile();
  await migrateCv();
  await migrateApplications();
  await migrateReports();
  await migratePipeline();
  await migrateScanHistory();
  await migratePortals();
  await migrateStoryBank();
  console.log('[migrate] done');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[migrate] fatal:', err);
  process.exit(1);
});
