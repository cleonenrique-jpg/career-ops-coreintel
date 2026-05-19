import type { PortalConfig, RawCandidate } from '../types.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

export const procomer: PortalConfig = {
  name: 'PROCOMER Talent',
  source: 'procomer',
  requiresEnv: ['PROCOMER_EMAIL', 'PROCOMER_PASSWORD'],
  fetcher: async (ctx, env) => {
    const page = await ctx.newPage();
    await page.goto('https://talento.procomer.com/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('input[name="email"]').fill(env.PROCOMER_EMAIL!);
    await page.locator('input[name="password"]').fill(env.PROCOMER_PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(2000);
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
    const loggedIn = !/no coinciden|invalid|error/i.test(bodyText);
    await page.close();
    if (!loggedIn) {
      console.log('  ✗ PROCOMER login rejected — check env credentials');
      return [];
    }

    const all: RawCandidate[] = [];
    let p = 1;
    let last = 1;
    do {
      const url = `https://talento.procomer.com/api/candidate/jobs-available?page=${p}&search=`;
      const resp = await ctx.request.get(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
      if (![200, 202].includes(resp.status())) {
        console.log(`  ✗ Procomer API page ${p} returned HTTP ${resp.status()}`);
        break;
      }
      const json: any = await resp.json().catch(() => ({}));
      last = json.last_page || 1;
      if (p === 1) console.log(`  ↻ Procomer API: ${json.total || '?'} jobs across ${last} pages`);
      for (const job of json.data || []) {
        const provincia = job.provincia || '';
        const canton = job.canton || '';
        const location = [provincia, canton].filter(Boolean).join(', ');
        all.push({
          title: (job.name || '').trim(),
          url: `https://talento.procomer.com/interview/${job.id}`,
          company: '',
          location,
        });
      }
      p++;
    } while (p <= last && p <= 100);
    return all;
  },
};
