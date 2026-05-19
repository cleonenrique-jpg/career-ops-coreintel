// Ported from liveness-core.mjs (legacy career-ops). Heuristics unchanged.

import type { Liveness } from '@career-ops/shared';

const HARD_EXPIRED_PATTERNS: RegExp[] = [
  /job (is )?no longer available/i,
  /job.*no longer open/i,
  /position has been filled/i,
  /this job has expired/i,
  /job posting has expired/i,
  /no longer accepting applications/i,
  /this (position|role|job) (is )?no longer/i,
  /this job (listing )?is closed/i,
  /job (listing )?not found/i,
  /the page you are looking for doesn.t exist/i,
  /diese stelle (ist )?(nicht mehr|bereits) besetzt/i,
  /offre (expirée|n'est plus disponible)/i,
];

const LISTING_PAGE_PATTERNS: RegExp[] = [
  /\d+\s+jobs?\s+found/i,
  /search for jobs page is loaded/i,
];

const EXPIRED_URL_PATTERNS: RegExp[] = [/[?&]error=true/i];

const APPLY_PATTERNS: RegExp[] = [
  /\bapply\b/i,
  /\bsolicitar\b/i,
  /\bbewerben\b/i,
  /\bpostuler\b/i,
  /submit application/i,
  /easy apply/i,
  /start application/i,
  /ich bewerbe mich/i,
];

const MIN_CONTENT_CHARS = 300;

function firstMatch(patterns: RegExp[], text = ''): RegExp | undefined {
  return patterns.find((p) => p.test(text));
}

function hasApplyControl(controls: string[]): boolean {
  return controls.some((c) => APPLY_PATTERNS.some((p) => p.test(c)));
}

export interface LivenessInput {
  status?: number;
  finalUrl?: string;
  bodyText?: string;
  applyControls?: string[];
}

export function classifyLiveness({
  status = 0, finalUrl = '', bodyText = '', applyControls = [],
}: LivenessInput = {}): Liveness {
  if (status === 404 || status === 410) {
    return { result: 'expired', reason: `HTTP ${status}` };
  }

  if (firstMatch(EXPIRED_URL_PATTERNS, finalUrl)) {
    return { result: 'expired', reason: `redirect to ${finalUrl}` };
  }

  const expiredBody = firstMatch(HARD_EXPIRED_PATTERNS, bodyText);
  if (expiredBody) {
    return { result: 'expired', reason: `pattern matched: ${expiredBody.source}` };
  }

  if (hasApplyControl(applyControls)) {
    return { result: 'active', reason: 'visible apply control detected' };
  }

  const listingPage = firstMatch(LISTING_PAGE_PATTERNS, bodyText);
  if (listingPage) {
    return { result: 'expired', reason: `pattern matched: ${listingPage.source}` };
  }

  if (bodyText.trim().length < MIN_CONTENT_CHARS) {
    return { result: 'expired', reason: 'insufficient content — likely nav/footer only' };
  }

  return { result: 'uncertain', reason: 'content present but no visible apply control found' };
}
