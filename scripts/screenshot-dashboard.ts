// Takes full-page screenshots of every web route at 1440x900 (desktop) and
// 390x844 (mobile) so we can review the UI without needing to load the
// browser manually. Saves under /tmp/dashboard-screens/.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import postgres from 'postgres';

const OUT = '/tmp/dashboard-screens';
const BASE = 'http://localhost:3000';

const sql = postgres(process.env.DATABASE_URL_POOLER!, { max: 1, prepare: false });
const [app] = await sql<{ id: string }[]>`select id from applications order by num limit 1`;
await sql.end();
const sampleAppId = app?.id;

const ROUTES: Array<{ path: string; label: string }> = [
  { path: '/',                              label: 'dashboard' },
  { path: '/pipeline',                      label: 'pipeline' },
  { path: '/applications',                  label: 'applications-list' },
  { path: `/applications/${sampleAppId}`,   label: 'application-detail' },
  { path: '/cv',                            label: 'cv' },
  { path: '/profile',                       label: 'profile' },
  { path: '/portals',                       label: 'portals' },
  { path: '/scan',                          label: 'scan' },
  { path: '/login',                         label: 'login' },
];

const VIEWPORTS = [
  { w: 1440, h: 900, suffix: 'desktop' },
  { w: 390,  h: 844, suffix: 'mobile' },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    for (const r of ROUTES) {
      const url = `${BASE}${r.path}`;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
        // Wait for client-side data loads (api calls done from useEffect).
        await page.waitForTimeout(1500);
        const file = `${OUT}/${r.label}-${vp.suffix}.png`;
        await page.screenshot({ path: file, fullPage: true });
        console.log(`✓ ${vp.suffix.padEnd(7)} ${r.label.padEnd(20)} → ${file}`);
      } catch (err) {
        console.error(`✗ ${vp.suffix} ${r.label}: ${err instanceof Error ? err.message : err}`);
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
