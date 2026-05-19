// Optional Gemini-Flash pass over scan results before they go to the pipeline.
// The cheap, deterministic filter is buildTitleFilter() in @career-ops/scan-core —
// this is only used when the user wants the LLM to second-pass title relevance
// (e.g. for free-text job boards where keyword matching misses synonyms).

import { z } from 'zod';
import { callGemini, pickModel } from './client.js';

const PROMPT_VERSION = 'filterScan@1';

export const ScanFilterSchema = z.object({
  decisions: z.array(z.object({
    url: z.string(),
    keep: z.boolean(),
    reason: z.string(),
  })),
});
export type ScanFilter = z.infer<typeof ScanFilterSchema>;

export interface FilterScanInput {
  jobs: Array<{ url: string; title: string; company: string; location: string | null }>;
  archetypes: Array<{ name: string; level: string; fit: string }>;
  locationPolicy: string;
  userId: string;
}

const SYSTEM_PROMPT = `Sos un asistente que filtra ofertas laborales por relevancia frente al perfil del candidato.
Solo "keep:true" si el título Y location encajan con los arquetipos objetivo y la política de ubicación.
NO uses el JD (no lo tenés). Decidí por título + empresa + location.`;

export async function filterScanResults(input: FilterScanInput) {
  const userPrompt = [
    '## Arquetipos objetivo',
    JSON.stringify(input.archetypes, null, 2),
    '',
    '## Política de ubicación',
    input.locationPolicy,
    '',
    '## Lista de ofertas a filtrar',
    JSON.stringify(input.jobs, null, 2),
  ].join('\n');

  return callGemini<ScanFilter>({
    model: pickModel('flash'),
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: ScanFilterSchema,
    userId: input.userId,
  });
}
