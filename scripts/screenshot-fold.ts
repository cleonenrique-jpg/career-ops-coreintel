// Top-of-fold screenshot of /applications (no fullPage) for design review.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/applications', { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/dashboard-screens/apps-fold.png', fullPage: false });
console.log('✓ /tmp/dashboard-screens/apps-fold.png');

await page.evaluate(() => window.scrollTo(0, 800));
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/dashboard-screens/apps-rows.png', fullPage: false });
console.log('✓ /tmp/dashboard-screens/apps-rows.png');

await browser.close();
