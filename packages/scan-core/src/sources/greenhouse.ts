import type { RawJob } from '../types.js';

interface GreenhouseJob {
  title?: string;
  absolute_url?: string;
  location?: { name?: string };
  updated_at?: string;
  created_at?: string;
}

export function parseGreenhouse(json: { jobs?: GreenhouseJob[] }, companyName: string): RawJob[] {
  const jobs = json.jobs ?? [];
  return jobs.map((j) => ({
    title: j.title ?? '',
    url: j.absolute_url ?? '',
    company: companyName,
    location: j.location?.name ?? '',
    postedAt: j.updated_at ?? j.created_at ?? null,
  }));
}
