// Consumes pdfgen jobs — renders templates/cv-template.html with the user's CV data,
// produces a PDF via Playwright, uploads to Supabase Storage, links it on the application.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { boss, QUEUES, type PdfgenJobData } from './lib/queue.js';
import { uploadPdf } from './lib/storage.js';
import { db, applications, cvs, profiles } from '@career-ops/db';
import { and, desc, eq } from 'drizzle-orm';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(here, '../../templates/cv-template.html');

let browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (!browser) browser = await chromium.launch({ headless: true });
  return browser;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

async function handleBatch(jobs: Array<{ data: PdfgenJobData }>) {
  for (const job of jobs) {
    await handleOne(job.data);
  }
}

async function handleOne(data: PdfgenJobData) {
  const { userId, applicationId } = data;

  const [app] = await db.select().from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
  if (!app) throw new Error(`application ${applicationId} not found`);

  const userProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!userProfile) throw new Error(`profile not found for ${userId}`);

  const [activeCv] = await db.select().from(cvs)
    .where(and(eq(cvs.userId, userId), eq(cvs.isActive, true)))
    .orderBy(desc(cvs.createdAt)).limit(1);
  if (!activeCv) throw new Error(`no active CV for ${userId}`);

  const tpl = await readFile(TEMPLATE_PATH, 'utf-8');
  const html = renderTemplate(tpl, {
    NAME: userProfile.fullName,
    EMAIL: userProfile.email,
    PHONE: userProfile.phone ?? '',
    LOCATION: userProfile.location ?? '',
    LINKEDIN: userProfile.linkedin ?? '',
    PORTFOLIO: userProfile.portfolioUrl ?? '',
    CV_BODY: activeCv.contentMd,
    COMPANY: app.company,
    ROLE: app.role,
  });

  const b = await getBrowser();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'Letter', margin: { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' } });

    const filename = `cv-${slugify(userProfile.fullName)}-${slugify(app.company)}-${app.date}.pdf`;
    const pdfUrl = await uploadPdf(userId, filename, pdf);

    await db.update(applications).set({ pdfUrl }).where(eq(applications.id, applicationId));
    console.log(`[pdfgen] ${app.company} → ${pdfUrl}`);
  } finally {
    await ctx.close();
  }
}

async function main() {
  await boss.start();
  await boss.createQueue(QUEUES.pdfgen).catch(() => {});
  await boss.work<PdfgenJobData>(QUEUES.pdfgen, { batchSize: 1 }, handleBatch);
  console.log('[pdfgen] ready');
}

process.on('SIGTERM', async () => { await boss.stop(); if (browser) await browser.close(); process.exit(0); });
process.on('SIGINT',  async () => { await boss.stop(); if (browser) await browser.close(); process.exit(0); });

main().catch((err) => { console.error('[pdfgen] fatal:', err); process.exit(1); });
