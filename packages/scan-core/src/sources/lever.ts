import type { RawJob } from '../types.js';

interface LeverJob {
  text?: string;
  hostedUrl?: string;
  categories?: { location?: string };
  createdAt?: number;
}

export function parseLever(json: unknown, companyName: string): RawJob[] {
  if (!Array.isArray(json)) return [];
  return (json as LeverJob[]).map((j) => ({
    title: j.text ?? '',
    url: j.hostedUrl ?? '',
    company: companyName,
    location: j.categories?.location ?? '',
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
  }));
}
