import type { PortalConfig } from '../types.js';

const DEFAULT_KEYWORDS = ['gerente', 'director', 'country manager'];

// Talent.com busca por keyword libre (?k=). Codificamos el rol con '+' por espacio.
function term(q: string): string {
  return encodeURIComponent(q.toLowerCase().trim()).replace(/%20/g, '+');
}

export const talentCom: PortalConfig = {
  name: 'Talent.com CR',
  source: 'talent',
  buildUrls: (queries) => {
    const kws = (queries && queries.length ? queries : DEFAULT_KEYWORDS).slice(0, 4).map(term).filter(Boolean);
    return kws.flatMap((kw) => [
      `https://cr.talent.com/jobs?k=${kw}&l=Costa+Rica`,
      ...[2, 3, 4, 5].map((p) => `https://cr.talent.com/jobs?k=${kw}&l=Costa+Rica&p=${p}`),
    ]);
  },
  pageExtractor: () => {
    // Title & company live in the aria-label of "Mostrar más" links:
    //   "Mostrar más for {TITLE} at {COMPANY}"
    const re = /\/view\?id=/;
    const ariaRe = /^Mostrar m[aá]s for (.+?) at (.+)$/i;
    const out: Array<{ title: string; url: string; company: string; location: string }> = [];
    const seen = new Set<string>();
    for (const a of Array.from(document.querySelectorAll('a[href*="/view?id="]')) as HTMLAnchorElement[]) {
      const url = a.href.split('#')[0]!;
      if (!re.test(url) || seen.has(url)) continue;
      seen.add(url);
      const aria = a.getAttribute('aria-label') || '';
      const m = aria.match(ariaRe);
      if (!m) continue;
      out.push({ title: m[1]!.trim(), url, company: m[2]!.trim(), location: '' });
    }
    return out;
  },
};
