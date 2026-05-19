import { z } from 'zod';
import { APPLICATION_STATUSES, PIPELINE_URL_STATUSES, LIVENESS_RESULTS, SCAN_SOURCES } from './states.js';

export const ProfileSchema = z.object({
  full_name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  portfolio_url: z.string().nullable().optional(),
  github: z.string().nullable().optional(),
  archetypes: z.array(z.object({
    name: z.string(),
    level: z.string(),
    fit: z.enum(['primary', 'secondary', 'adjacent']),
  })).default([]),
  narrative: z.string().nullable().optional(),
  superpowers: z.array(z.string()).default([]),
  comp_target_min: z.number().nullable().optional(),
  comp_target_max: z.number().nullable().optional(),
  comp_currency: z.string().default('USD'),
  language_mode: z.enum(['en', 'es', 'de', 'fr', 'ja']).default('es'),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ApplicationSchema = z.object({
  num: z.number().int().positive(),
  date: z.string(),
  company: z.string(),
  role: z.string(),
  score: z.number().min(0).max(5).nullable(),
  status: z.enum(APPLICATION_STATUSES),
  pdf_url: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type Application = z.infer<typeof ApplicationSchema>;

export const PipelineUrlSchema = z.object({
  url: z.string().url(),
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  status: z.enum(PIPELINE_URL_STATUSES),
  scanned_at: z.string(),
  processed_at: z.string().nullable().optional(),
  application_id: z.string().uuid().nullable().optional(),
});
export type PipelineUrl = z.infer<typeof PipelineUrlSchema>;

export const ScanHistorySchema = z.object({
  url: z.string().url(),
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  source: z.enum(SCAN_SOURCES),
  first_seen_at: z.string(),
});
export type ScanHistory = z.infer<typeof ScanHistorySchema>;

export const LivenessSchema = z.object({
  result: z.enum(LIVENESS_RESULTS),
  reason: z.string(),
});
export type Liveness = z.infer<typeof LivenessSchema>;
