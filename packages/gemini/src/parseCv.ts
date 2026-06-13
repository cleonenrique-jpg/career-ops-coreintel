// Onboarding: convierte el texto crudo del CV del usuario en (a) un cv.md
// limpio en markdown y (b) un borrador de perfil (roles objetivo, ubicación,
// superpoderes) que el wizard deja editar antes de activar la cuenta.

import { z } from 'zod';
import { callGemini, pickModel } from './client.js';

const PROMPT_VERSION = 'parse-cv@1';

export const ParsedCvSchema = z.object({
  cvMarkdown: z.string().describe('El CV completo reescrito en markdown limpio con secciones estándar'),
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable().describe('Ciudad, país'),
  linkedin: z.string().nullable(),
  targetRoles: z.array(z.string()).max(5).describe('3-5 títulos de rol que esta persona debería buscar, en el idioma del CV'),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'executive']),
  superpowers: z.array(z.string()).max(5).describe('3-5 fortalezas diferenciales concretas extraídas del CV'),
  narrative: z.string().describe('2-3 frases que resumen el posicionamiento profesional de la persona'),
});

export type ParsedCv = z.infer<typeof ParsedCvSchema>;

const SYSTEM_PROMPT = `Sos un experto en reclutamiento y redacción de CVs para el mercado laboral de Latinoamérica y remoto global.
Tu tarea: a partir del texto crudo de un CV (puede venir desordenado, copiado de un PDF), producir:

1. cvMarkdown: el CV completo reescrito en markdown limpio y profesional con secciones estándar
   (## Resumen, ## Experiencia, ## Proyectos, ## Educación, ## Skills). NO inventes información:
   usá solo lo que está en el texto. Conservá métricas y logros textuales. Mantené el idioma original del CV.
2. Datos de perfil extraídos (nombre, contacto, ubicación, linkedin) — null si no aparecen.
3. targetRoles: los títulos de puesto que mejor calzan con esta trayectoria (los que esta persona
   debería buscar en portales de empleo). Concretos, ej: "Gerente de Operaciones", no "líder".
4. superpowers: fortalezas diferenciales REALES extraídas del CV (con evidencia), no genéricas.
5. narrative: posicionamiento profesional en 2-3 frases, primera persona.`;

export async function parseCv(input: { cvText: string; userId: string }): Promise<ParsedCv> {
  const { data } = await callGemini<ParsedCv>({
    model: pickModel('pro'),
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Texto crudo del CV:\n\n${input.cvText.slice(0, 30_000)}`,
    schema: ParsedCvSchema,
    userId: input.userId,
    temperature: 0.1,
  });
  return data;
}
