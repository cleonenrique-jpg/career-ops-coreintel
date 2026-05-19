// Adapts legacy modes/interview-prep.md. JD-focused, no CV STAR stories.

import { z } from 'zod';
import { callGemini } from './client.js';

const PROMPT_VERSION = 'interviewPrep@1';

export const InterviewPrepSchema = z.object({
  block1_companyOverview: z.string(),
  block2_roleDeepDive: z.string(),
  block3_first90Days: z.array(z.string()),
  block4_keyStakeholders: z.array(z.object({
    name: z.string(),
    role: z.string(),
    importance: z.string(),
  })),
  block5_likelyInterviewQuestions: z.array(z.string()),
  block6_questionsForThem: z.array(z.string()),
});
export type InterviewPrep = z.infer<typeof InterviewPrepSchema>;

export interface GenerateInterviewPrepInput {
  jd: string;
  company: string;
  role: string;
  profileNarrative: string;
  userId: string;
  applicationId: string;
}

const SYSTEM_PROMPT = `Sos un coach de entrevistas. El candidato YA confirmó entrevista — no es eval; es prep concreta para EJECUTAR el rol.
- Block 1 (companyOverview): contexto de negocio, modelo, escala, momentum.
- Block 2 (roleDeepDive): lectura entre líneas del JD — qué se va a esperar realmente.
- Block 3 (first90Days): lista accionable de 5-8 ítems que el candidato debería tener listos para discutir.
- Block 4 (keyStakeholders): personas/roles con las que va a tener interfaz.
- Block 5: 8-12 preguntas probables del panel, ordenadas de más probables a menos.
- Block 6: 4-6 preguntas para hacerle al panel que demuestren entendimiento estratégico.`;

export async function generateInterviewPrep(input: GenerateInterviewPrepInput) {
  const userPrompt = [
    `## Empresa: ${input.company}`,
    `## Rol: ${input.role}`,
    '',
    '## Narrativa del candidato',
    input.profileNarrative,
    '',
    '## Job Description',
    input.jd,
  ].join('\n');

  return callGemini<InterviewPrep>({
    model: process.env.GEMINI_MODEL_PRO ?? 'gemini-2.5-pro',
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: InterviewPrepSchema,
    userId: input.userId,
    applicationId: input.applicationId,
  });
}

export function renderInterviewPrep(p: InterviewPrep, company: string, role: string): string {
  const stakeholdersTable = p.block4_keyStakeholders.length === 0
    ? '_No identificados._'
    : [
        '| Persona / Rol | Importancia |',
        '|---------------|-------------|',
        ...p.block4_keyStakeholders.map((s) => `| ${s.name} — ${s.role} | ${s.importance} |`),
      ].join('\n');

  return `# Interview Prep: ${company} — ${role}

## I. Company Overview
${p.block1_companyOverview}

## II. Role Deep Dive
${p.block2_roleDeepDive}

## III. First 90 Days
${p.block3_first90Days.map((d) => `- ${d}`).join('\n')}

## IV. Key Stakeholders
${stakeholdersTable}

## V. Likely Interview Questions
${p.block5_likelyInterviewQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## VI. Questions to Ask the Panel
${p.block6_questionsForThem.map((q) => `- ${q}`).join('\n')}
`;
}
