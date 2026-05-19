import { chromium, type Browser } from 'playwright';
import { classifyLiveness } from '@career-ops/scan-core';

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

export interface FetchedJd {
  jd: string;
  finalUrl: string;
  status: number;
  liveness: ReturnType<typeof classifyLiveness>;
}

export async function fetchJd(url: string): Promise<FetchedJd> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const status = response?.status() ?? 0;
    const finalUrl = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const applyControls = await page.locator('button, a, [role=button]').allInnerTexts().catch(() => []);

    const liveness = classifyLiveness({ status, finalUrl, bodyText, applyControls });
    return { jd: bodyText, finalUrl, status, liveness };
  } finally {
    await context.close();
  }
}

export async function shutdownBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}
