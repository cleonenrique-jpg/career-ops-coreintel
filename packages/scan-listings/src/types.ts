import type { BrowserContext } from 'playwright';

export interface RawCandidate {
  title: string;
  url: string;
  company: string;
  location: string;
}

export interface PortalRunStats {
  found: number;
  kept: number;
  skipped_title: number;
  skipped_geo: number;
  skipped_dup: number;
  errors: number;
}

export interface PortalRunResult {
  portal: string;
  source: string; // matches scan_source enum
  stats: PortalRunStats;
  newOffers: RawCandidate[];
}

/** Optional enrichment hook — fills in missing company/location via portal-specific detail APIs. */
export type Enricher = (ctx: BrowserContext, offer: RawCandidate) => Promise<RawCandidate>;

/** Custom fetcher (auth + API) — Procomer, CINDE GraphQL, etc. */
export type Fetcher = (ctx: BrowserContext, env: Record<string, string | undefined>) => Promise<RawCandidate[]>;

/** Page-context extractor — runs inside page.evaluate(), must be self-contained. */
export type PageExtractor = () => RawCandidate[];

export interface PortalConfig {
  name: string;
  source: 'talent' | 'computrabajo' | 'procomer' | 'cinde' | 'linkedin';
  urls?: string[];
  /** Construye las URLs de búsqueda desde las queries del usuario (roles
   *  objetivo). Sin queries → cae a las keywords default del portal. Tiene
   *  prioridad sobre `urls` cuando está definido. */
  buildUrls?: (queries: string[]) => string[];
  pageExtractor?: PageExtractor;
  fetcher?: Fetcher;
  enricher?: Enricher;
  requiresEnv?: string[];
  note?: string;
}

export interface TitleFilter {
  positive: string[];
  negative: string[];
}

export interface GeoFilter {
  require_any: string[];
  exclude_if_only: string[];
}

export interface ScrapeFilters {
  title: (s: string) => boolean;
  geo: (c: { title: string; company: string; location: string }) => boolean;
}
