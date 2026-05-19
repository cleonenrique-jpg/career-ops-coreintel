import type { TitleFilter } from './types.js';

export function buildTitleFilter(tf: Partial<TitleFilter>): (title: string) => boolean {
  const positive = (tf.positive ?? []).map((k) => k.toLowerCase());
  const negative = (tf.negative ?? []).map((k) => k.toLowerCase());

  return (title: string) => {
    const lower = title.toLowerCase();
    const hasPositive = positive.length === 0 || positive.some((k) => lower.includes(k));
    const hasNegative = negative.some((k) => lower.includes(k));
    return hasPositive && !hasNegative;
  };
}

export function isWithinAge(postedAt: string | null, maxDays: number, now: Date = new Date()): boolean {
  if (!postedAt) return true;
  const posted = new Date(postedAt);
  if (Number.isNaN(posted.getTime())) return true;
  const ageDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays <= maxDays;
}
