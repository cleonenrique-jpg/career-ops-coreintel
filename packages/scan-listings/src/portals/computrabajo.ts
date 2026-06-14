import type { PortalConfig } from '../types.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
const DEFAULT_KEYWORDS = ['gerente', 'director', 'jefe', 'country-manager'];

// Computrabajo usa páginas-categoría SEO: /trabajo-de-{slug}. Convertimos cada
// rol objetivo a un slug con guiones (sin acentos ni símbolos).
function slugify(q: string): string {
  return q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const computrabajo: PortalConfig = {
  name: 'Computrabajo CR',
  source: 'computrabajo',
  buildUrls: (queries) => {
    const kws = (queries && queries.length ? queries : DEFAULT_KEYWORDS).slice(0, 4).map(slugify).filter(Boolean);
    return kws.flatMap((kw) => [
      `https://www.computrabajo.co.cr/trabajo-de-${kw}`,
      ...[2, 3, 4, 5].map((p) => `https://www.computrabajo.co.cr/trabajo-de-${kw}?p=${p}`),
    ]);
  },
  pageExtractor: () => {
    const out: Array<{ title: string; url: string; company: string; location: string }> = [];
    const seen = new Set<string>();
    for (const art of Array.from(document.querySelectorAll('article.box_offer')) as HTMLElement[]) {
      const a = art.querySelector('a[href*="/ofertas-de-trabajo/"]') as HTMLAnchorElement | null;
      if (!a) continue;
      const url = a.href.split('#')[0]!;
      if (seen.has(url)) continue;
      seen.add(url);
      const title = (a.innerText || '').trim();
      const compA = art.querySelector('a[href*="/empresas/"]') as HTMLAnchorElement | null;
      const company = compA ? (compA.innerText || '').trim() : '';
      const parts = (art.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const location = parts.find((p) => /,\s*(San José|Heredia|Alajuela|Cartago|Guanacaste|Puntarenas|Limón)/i.test(p)) || '';
      if (!title) continue;
      out.push({ title, url, company, location });
    }
    return out;
  },
  // Backfill missing company via detail JSON API.
  enricher: async (ctx, offer) => {
    if (offer.company) return offer;
    const m = offer.url.match(/-([A-F0-9]{32})(?:#|$|\?)/i);
    if (!m) return offer;
    try {
      const detailUrl = `https://oferta.computrabajo.com/offer/${m[1]}/d/j?ipo=8&iapo=1`;
      const resp = await ctx.request.get(detailUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', Referer: 'https://cr.computrabajo.com/' },
        timeout: 10000,
      });
      if (resp.status() !== 200) return offer;
      const json: any = await resp.json().catch(() => ({}));
      const cn = (json?.o?.cn || '').trim();
      const c = (json?.o?.c || '').trim();
      if (cn) offer.company = cn;
      if (!offer.location && c) offer.location = c;
    } catch { /* ignore */ }
    return offer;
  },
};
