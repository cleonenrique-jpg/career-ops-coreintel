// Mirrors templates/states.yml from the legacy repo.
// Both writer (workers) and reader (web) must use these exact labels.

export const APPLICATION_STATUSES = [
  'Evaluated',
  'Applied',
  'Responded',
  'Interview',
  'Offer',
  'Rejected',
  'Discarded',
  'SKIP',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_ALIASES: Record<string, ApplicationStatus> = {
  evaluated: 'Evaluated', evaluada: 'Evaluated',
  applied: 'Applied', aplicado: 'Applied', enviada: 'Applied', aplicada: 'Applied', sent: 'Applied',
  responded: 'Responded', respondido: 'Responded',
  interview: 'Interview', entrevista: 'Interview',
  offer: 'Offer', oferta: 'Offer',
  rejected: 'Rejected', rechazado: 'Rejected', rechazada: 'Rejected',
  discarded: 'Discarded', descartado: 'Discarded', descartada: 'Discarded', cerrada: 'Discarded', cancelada: 'Discarded',
  skip: 'SKIP', no_aplicar: 'SKIP', 'no aplicar': 'SKIP', monitor: 'SKIP',
};

export function normalizeStatus(raw: string): ApplicationStatus | null {
  const cleaned = raw.trim().replace(/\*\*/g, '').toLowerCase();
  return STATUS_ALIASES[cleaned] ?? null;
}

export const PIPELINE_URL_STATUSES = ['pending', 'processed', 'discarded', 'expired'] as const;
export type PipelineUrlStatus = (typeof PIPELINE_URL_STATUSES)[number];

export const LIVENESS_RESULTS = ['active', 'expired', 'uncertain'] as const;
export type LivenessResult = (typeof LIVENESS_RESULTS)[number];

export const SCAN_SOURCES = ['greenhouse', 'ashby', 'lever', 'linkedin', 'computrabajo', 'talent', 'tecoloco', 'manual'] as const;
export type ScanSource = (typeof SCAN_SOURCES)[number];
