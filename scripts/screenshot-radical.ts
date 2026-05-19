import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const targets: Array<{ url: string; file: string }> = [
  { url: 'http://localhost:3000/',                  file: '/tmp/dashboard-screens/radical-home.png' },
  { url: 'http://localhost:3000/profile?tab=info',  file: '/tmp/dashboard-screens/radical-profile-info.png' },
  { url: 'http://localhost:3000/profile?tab=cv',    file: '/tmp/dashboard-screens/radical-profile-cv.png' },
  { url: 'http://localhost:3000/profile?tab=archetypes', file: '/tmp/dashboard-screens/radical-profile-arch.png' },
  { url: 'http://localhost:3000/sistema?tab=fuentes', file: '/tmp/dashboard-screens/radical-sistema-fuentes.png' },
  { url: 'http://localhost:3000/sistema?tab=costos',  file: '/tmp/dashboard-screens/radical-sistema-costos.png' },
];

for (const t of targets) {
  await page.goto(t.url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: t.file, fullPage: false });
  console.log(`✓ ${t.url} → ${t.file}`);
}

await browser.close();
