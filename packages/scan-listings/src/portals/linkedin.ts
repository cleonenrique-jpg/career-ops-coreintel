import type { PortalConfig } from '../types.js';

const DEFAULT_KEYWORDS = ['gerente', 'director'];

// LinkedIn busca por keyword libre. Codificamos el rol completo (URL-encoded).
function kwenc(q: string): string {
  return encodeURIComponent(q.toLowerCase().trim());
}

export const linkedin: PortalConfig = {
  name: 'LinkedIn CR',
  source: 'linkedin',
  buildUrls: (queries) => {
    const kws = (queries && queries.length ? queries : DEFAULT_KEYWORDS).slice(0, 4).map(kwenc).filter(Boolean);
    return kws.flatMap((kw) => [
      `https://cr.linkedin.com/jobs/search?keywords=${kw}&location=Costa%20Rica`,
      ...[25, 50, 75, 100].map((s) => `https://cr.linkedin.com/jobs/search?keywords=${kw}&location=Costa%20Rica&start=${s}`),
    ]);
  },
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
