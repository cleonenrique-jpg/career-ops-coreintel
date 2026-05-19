import type { ScanSource } from '@career-ops/shared';

export interface RawJob {
  title: string;
  url: string;
  company: string;
  location: string;
  postedAt: string | null; // ISO
}

export interface ScannedJob extends RawJob {
  source: ScanSource;
}

export interface CompanyPortal {
  name: string;
  enabled?: boolean;
  api?: string;
  careersUrl?: string;
}

export interface DetectedApi {
  type: 'greenhouse' | 'ashby' | 'lever';
  url: string;
}

export interface TitleFilter {
  positive: string[];
  negative: string[];
}
