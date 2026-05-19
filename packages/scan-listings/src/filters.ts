// Title + geo filters ported from legacy scan-listings.mjs.
// Word-boundary matching prevents short acronyms (CCO/COO) from matching
// inside longer words (ACCOunting, COOrdinador).

import type { TitleFilter, GeoFilter } from './types.js';

export function buildTitleFilter(tf: Partial<TitleFilter>): (title: string) => boolean {
  const toRegex = (k: string) => {
    const escaped = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\W)${escaped}(?=\\W|$)`, 'i');
  };
  const positive = (tf.positive ?? []).map(toRegex);
  const negative = (tf.negative ?? []).map(toRegex);
  return (title: string) => {
    const hasPositive = positive.length === 0 || positive.some((re) => re.test(title));
    const hasNegative = negative.some((re) => re.test(title));
    return hasPositive && !hasNegative;
  };
}

export function buildGeoFilter(gf: Partial<GeoFilter>): (c: { title: string; company: string; location: string }) => boolean {
  const requireAny = (gf.require_any ?? []).map((k) => k.toLowerCase());
  const excludeIfOnly = (gf.exclude_if_only ?? []).map((k) => k.toLowerCase());
  return ({ title, company, location }) => {
    const haystack = `${title} ${company} ${location}`.toLowerCase();
    if (excludeIfOnly.some((k) => haystack.includes(k))) return false;
    if (requireAny.some((k) => haystack.includes(k))) return true;
    // Ambiguous: downstream evaluator catches remote-LATAM that wasn't flagged.
    return true;
  };
}
