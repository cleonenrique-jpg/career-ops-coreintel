// Generates a "Role Playbook" — for each JD responsibility, what a senior
// professional would actually do to execute it well. Not interview Q&A; not
// CV/STAR stories. JD-focused operational playbook.

import { z } from 'zod';
import { callGemini, pickModel } from './client.js';

const PROMPT_VERSION = 'rolePlaybook@1';

export const InterviewPrepSchema = z.object({
  responsibilities: z.array(z.object({
    title: z.string(),
    jdQuote: z.string(),
    professionalActions: z.array(z.string()).min(4).max(8),
    successSignal: z.string(),
  })).min(4).max(8),
  firstMonthPlaybook: z.array(z.string()).min(3).max(6),
  redFlagsToAvoid: z.array(z.string()).min(3).max(6),
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

const SYSTEM_PROMPT = `Sos un coach senior con 15+ años en el dominio del rol. Tu trabajo NO es prep de entrevista (no genéres preguntas probables, no analices empresa, no inventes stakeholders). Tu trabajo es un PLAYBOOK OPERATIVO: para cada responsabilidad del JD, describí qué hace un profesional senior para ejecutarla con excelencia.

Reglas duras:
- Extraé entre 5 y 7 responsabilidades distintas del JD. Si el JD es escueto, deducí responsabilidades implícitas razonables del título y dominio.
- Por cada responsabilidad: (a) "title" — el nombre corto (ej. "Domain Leadership"), (b) "jdQuote" — la frase textual del JD (parafraseada si no es literal), (c) "professionalActions" — 5-7 bullets concretos, accionables, específicos del dominio (NO platitudes como "comunica efectivamente"; SÍ "mantiene un repositorio de 15-25 casos resueltos para training"), (d) "successSignal" — una métrica o señal observable de "lo estoy haciendo bien" (ej. "el equipo deja de escalar el 80% de las dudas que antes le llegaban").
- "firstMonthPlaybook": 4-6 ítems concretos de qué hace en su primer mes para entrar bien (shadows, reuniones, entregables específicos).
- "redFlagsToAvoid": 3-5 errores típicos que un profesional senior NO comete en ese rol.

Estilo:
- Español. Lenguaje directo, técnico del dominio, sin marketing ni adjetivos vacíos.
- Cero generalidades. Si una acción no es específica del rol/dominio, no la incluyas.
- Si el dominio tiene tooling estándar, mencionálo por nombre (ej. para accounting: QuickBooks, NetSuite, Bill.com, Dext; para sales ops: Salesforce, HubSpot, Outreach; para data eng: Airflow, dbt, Snowflake).
- Si hay marcos regulatorios o standards aplicables, nombralos (US GAAP, ASC 606, GDPR, SOC2, etc.).

El candidato YA confirmó entrevista — esto es para PREPARARSE A EJECUTAR EL ROL, no para impresionar al panel.`;

export async function generateInterviewPrep(input: GenerateInterviewPrepInput) {
  const userPrompt = [
    `## Empresa: ${input.company}`,
    `## Rol: ${input.role}`,
    '',
    '## Job Description (fuente de verdad — extraé responsabilidades de acá)',
    input.jd,
    '',
    '## Narrativa del candidato (contexto secundario; NO la uses para STAR stories)',
    input.profileNarrative || '_No disponible._',
  ].join('\n');

  return callGemini<InterviewPrep>({
    model: pickModel('pro'),
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: InterviewPrepSchema,
    userId: input.userId,
    applicationId: input.applicationId,
  });
}

export function renderInterviewPrep(p: InterviewPrep, company: string, role: string): string {
  const responsibilities = p.responsibilities.map((r, i) => `## ${i + 1}. ${r.title}

**JD:** ${r.jdQuote}

**Qué hace un profesional senior:**

${r.professionalActions.map((a) => `- ${a}`).join('\n')}

**Señal de éxito:** ${r.successSignal}

---
`).join('\n');

  const firstMonth = p.firstMonthPlaybook.map((item, i) => `${i + 1}. ${item}`).join('\n');
  const redFlags = p.redFlagsToAvoid.map((item) => `- ${item}`).join('\n');

  return `# Playbook operativo: ${company} — ${role}

> Para cada responsabilidad del JD, qué hace un profesional senior para ejecutarla con excelencia. No es teoría: son las acciones concretas, los entregables esperados y las señales de "lo estoy haciendo bien".

---

${responsibilities}

## Primer mes: cómo se ve hacerlo bien

${firstMonth}

---

## Red flags a evitar

${redFlags}
`;
}
