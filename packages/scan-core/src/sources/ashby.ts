import type { RawJob } from '../types.js';

interface AshbyJob {
  title?: string;
  jobUrl?: string;
  location?: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function parseAshby(json: { jobs?: AshbyJob[] }, companyName: string): RawJob[] {
  const jobs = json.jobs ?? [];
  return jobs.map((j) => ({
    title: j.title ?? '',
    url: j.jobUrl ?? '',
    company: companyName,
    location: j.location ?? '',
    postedAt: j.publishedAt ?? j.createdAt ?? j.updatedAt ?? null,
  }));
}
