// Adapts legacy modes/oferta.md + modes/_shared.md (blocks A, B, C).
// LLM produces structured JSON; the worker renders the markdown report from it.

import { z } from 'zod';
import { callGemini, pickModel } from './client.js';

const PROMPT_VERSION = 'oferta@1';

export const OfferEvalSchema = z.object({
  archetype: z.object({
    primary: z.string(),
    secondary: z.string().nullable().optional(),
    rationale: z.string(),
  }),
  blockA: z.object({
    domain: z.string(),
    function: z.enum(['build', 'consult', 'manage', 'deploy', 'hybrid']),
    seniority: z.string(),
    remote: z.enum(['full', 'hybrid', 'onsite', 'unknown']),
    teamSize: z.string().nullable().optional(),
    industry: z.string(),
    contract: z.string().nullable().optional(),
    tldr: z.string(),
  }),
  blockB: z.object({
    matches: z.array(z.object({
      requirement: z.string(),
      evidence: z.string(),
      status: z.enum(['meets', 'partial', 'gap']),
    })),
    gaps: z.array(z.object({
      gap: z.string(),
      type: z.enum(['hard_blocker', 'nice_to_have']),
      mitigation: z.string(),
    })),
  }),
  blockC: z.object({
    score: z.number().min(0).max(5),
    decision: z.enum(['apply', 'review', 'discard']),
    reason: z.string(),
    applicationHook: z.string().nullable().optional(),
    framingForGaps: z.string().nullable().optional(),
  }),
});
export type OfferEval = z.infer<typeof OfferEvalSchema>;

export interface EvaluateOfferInput {
  jd: string;          // raw JD text scraped from the URL
  jdUrl: string;
  company: string;
  role: string;
  cvMd: string;        // contents of the user's active CV
  profileNarrative: string;
  archetypes: Array<{ name: string; level: string; fit: string }>;
  userId: string;
  pipelineUrlId?: string;
}

const SYSTEM_PROMPT = `Eres un evaluador senior de ofertas laborales. Tu trabajo es decidir RÁPIDO si una oferta vale la pena para el candidato.

Reglas duras:
- No inventes datos. Si el JD no menciona algo, dilo en evidence como "no especificado".
- El "score" es una decimal entre 0.0 y 5.0 con un decimal (ej: 4.2).
- Decisión: score ≥ 4.0 = "apply"; 3.0–3.9 = "review"; < 3.0 = "discard".
- Cuando hay mismatch claro (rol exige <3 años exp, candidato tiene 10), bajá el score.
- "function" debe ser una sola etiqueta (build/consult/manage/deploy/hybrid).
- En matches[].status: "meets" si supera o cumple plenamente; "partial" si es adyacente; "gap" si no hay evidencia.
- gaps[].type: "hard_blocker" si bloquea la aplicación (idioma, visa, residencia); "nice_to_have" si es deseable pero negociable.`;

export async function evaluateOffer(input: EvaluateOfferInput) {
  const userPrompt = [
    '## CV del candidato (cv.md)',
    input.cvMd,
    '',
    '## Narrativa profesional',
    input.profileNarrative,
    '',
    '## Arquetipos objetivo',
    JSON.stringify(input.archetypes, null, 2),
    '',
    '## Job Description',
    `Empresa: ${input.company}`,
    `Rol: ${input.role}`,
    `URL: ${input.jdUrl}`,
    '',
    input.jd,
  ].join('\n');

  return callGemini<OfferEval>({
    model: pickModel('pro'),
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: OfferEvalSchema,
    userId: input.userId,
    pipelineUrlId: input.pipelineUrlId ?? null,
  });
}

// Render a markdown report from the structured eval (matches the legacy template).
export function renderOfferReport(params: {
  company: string;
  role: string;
  url: string;
  date: string;
  eval: OfferEval;
}): string {
  const { company, role, url, date, eval: e } = params;
  const decisionEmoji = e.blockC.decision === 'apply' ? '✅' : e.blockC.decision === 'review' ? '⚠️' : '❌';
  const decisionLabel = e.blockC.decision === 'apply' ? 'Aplicar' : e.blockC.decision === 'review' ? 'Revisar' : 'Descartar';

  const matchesTable = [
    '| # | Requisito del JD | Evidencia en cv.md | Status |',
    '|---|------------------|---------------------|--------|',
    ...e.blockB.matches.map((m, i) => {
      const icon = m.status === 'meets' ? '✅' : m.status === 'partial' ? '⚠️' : '❌';
      return `| ${i + 1} | ${escape(m.requirement)} | ${escape(m.evidence)} | ${icon} |`;
    }),
  ].join('\n');

  const gapsTable = e.blockB.gaps.length === 0
    ? '_No hay gaps relevantes._'
    : [
        '| Gap | Tipo | Mitigación |',
        '|-----|------|------------|',
        ...e.blockB.gaps.map((g) => `| ${escape(g.gap)} | ${g.type === 'hard_blocker' ? 'Hard blocker' : 'Nice-to-have'} | ${escape(g.mitigation)} |`),
      ].join('\n');

  return `# Evaluación: ${company} — ${role}

**Fecha:** ${date}
**URL:** ${url}
**Arquetipo:** ${e.archetype.primary}${e.archetype.secondary ? ` / ${e.archetype.secondary}` : ''}
**Score:** ${e.blockC.score.toFixed(1)}/5
**Decisión:** ${decisionLabel} ${decisionEmoji}

---

## A) Resumen del Rol

| Campo | Valor |
|-------|-------|
| Domain | ${e.blockA.domain} |
| Function | ${e.blockA.function} |
| Seniority | ${e.blockA.seniority} |
| Remote | ${e.blockA.remote} |
| Team size | ${e.blockA.teamSize ?? '—'} |
| Industria | ${e.blockA.industry} |
| Contrato | ${e.blockA.contract ?? '—'} |

**TL;DR:** ${e.blockA.tldr}

## B) Match con CV

${matchesTable}

### Gaps

${gapsTable}

## C) Decisión

**Score:** ${e.blockC.score.toFixed(1)}/5 — **${decisionLabel}** ${decisionEmoji}

${e.blockC.reason}

${e.blockC.applicationHook ? `**Gancho para cover letter / mensaje:** ${e.blockC.applicationHook}\n` : ''}
${e.blockC.framingForGaps ? `**Cómo enmarcar gaps:** ${e.blockC.framingForGaps}\n` : ''}
`;
}

function escape(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}
