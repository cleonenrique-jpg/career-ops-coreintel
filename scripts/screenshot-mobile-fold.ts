import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 1600 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/applications', { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/dashboard-screens/apps-mobile-fold.png', fullPage: false });
console.log('✓ /tmp/dashboard-screens/apps-mobile-fold.png');
await browser.close();
