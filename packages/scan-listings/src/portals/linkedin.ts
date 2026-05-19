import type { PortalConfig } from '../types.js';

const KEYWORDS = ['gerente', 'director'];

export const linkedin: PortalConfig = {
  name: 'LinkedIn CR',
  source: 'linkedin',
  urls: KEYWORDS.flatMap((kw) => [
    `https://cr.linkedin.com/jobs/search?keywords=${kw}&location=Costa%20Rica`,
    ...[25, 50, 75, 100].map((s) => `https://cr.linkedin.com/jobs/search?keywords=${kw}&location=Costa%20Rica&start=${s}`),
  ]),
  pageExtractor: () => {
    const re = /linkedin\.com\/jobs\/view\//;
    const out: Array<{ title: string; url: string; company: string; location: string }> = [];
    const seen = new Set<string>();
    for (const a of Array.from(document.querySelectorAll('a[href*="/jobs/view/"]')) as HTMLAnchorElement[]) {
      const url = a.href.split('?')[0]!;
      if (!re.test(url) || seen.has(url)) continue;
      seen.add(url);
      const card = a.closest('[data-job-id], li, .base-card');
      const title = ((card?.querySelector('h3, h2, .base-search-card__title') as HTMLElement | null)?.innerText || '').trim();
      const company = ((card?.querySelector('[class*="company"], h4') as HTMLElement | null)?.innerText || '').trim();
      const location = ((card?.querySelector('[class*="location"]') as HTMLElement | null)?.innerText || '').trim();
      if (!title) continue;
      out.push({ title, url, company, location });
    }
    return out;
  },
  note: 'Often rate-limited / requires login — partial coverage expected.',
};
