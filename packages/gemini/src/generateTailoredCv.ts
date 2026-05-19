// Generates a JD-tailored CV. Ported from legacy career-ops/modes/pdf.md.
// Hard rule: NEVER invent skills/experience. Only reformulate existing CV content
// using JD vocabulary.

import { z } from 'zod';
import { callGemini, pickModel } from './client.js';

const PROMPT_VERSION = 'tailoredCv@1';

const ExperienceBulletSchema = z.string();

const ExperienceRoleSchema = z.object({
  company: z.string(),
  role: z.string(),
  period: z.string(),
  location: z.string().optional(),
  bullets: z.array(ExperienceBulletSchema).min(2).max(8),
});

const ProjectSchema = z.object({
  title: z.string(),
  summary: z.string(),
  bullets: z.array(z.string()).min(0).max(5),
});

const EducationSchema = z.object({
  degree: z.string(),
  institution: z.string(),
  period: z.string(),
  details: z.string().optional(),
});

const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().optional(),
  year: z.string().optional(),
});

export const TailoredCvSchema = z.object({
  language: z.enum(['en', 'es']),
  paperFormat: z.enum(['letter', 'a4']),
  summary: z.string(),
  competencies: z.array(z.string()).min(6).max(10),
  experience: z.array(ExperienceRoleSchema).min(1).max(8),
  projects: z.array(ProjectSchema).min(0).max(4),
  education: z.array(EducationSchema).min(0).max(4),
  certifications: z.array(CertificationSchema).min(0).max(8),
  skills: z.array(z.string()).min(0).max(20),
  keywordCoverage: z.number().min(0).max(100),
});
export type TailoredCv = z.infer<typeof TailoredCvSchema>;

export interface GenerateTailoredCvInput {
  cvMd: string;
  jd: string;
  company: string;
  role: string;
  jdLocationHint?: string | null;
  userId: string;
  applicationId: string;
}

const SYSTEM_PROMPT = `Sos un especialista en optimización ATS de CVs. Tu trabajo: tomar un CV master en markdown + el JD de una oferta, y devolver una versión adaptada que (a) inyecte el vocabulario exacto del JD en los logros existentes, (b) reordene bullets por relevancia al JD, (c) seleccione los top 3-4 proyectos más relevantes, (d) construya un competency grid con 6-10 frases keyword-dense.

REGLA DURA (no negociable): NUNCA agregar skills, experiencias o certificaciones que el candidato no tenga ya en su CV master. Solo REFORMULAR experiencia real con el vocabulario exacto del JD.

Ejemplos de reformulación legítima:
- JD: "RAG pipelines" + CV: "LLM workflows with retrieval" → "RAG pipeline design and LLM orchestration workflows"
- JD: "MLOps" + CV: "observability, evals, error handling" → "MLOps and observability: evals, error handling, cost monitoring"
- JD: "stakeholder management" + CV: "collaborated with team" → "stakeholder management across engineering, operations, and business"

Ejemplos de lo que NO debés hacer:
- ❌ Agregar "AWS certified" si el CV no menciona AWS
- ❌ Agregar "10+ años en X" si el CV solo tiene 5
- ❌ Inventar proyectos o roles que no estén en el CV master

Pasos:
1. Detectar el idioma del JD ('en' o 'es') — el CV adaptado debe estar en ese idioma. Si el CV master está en otro idioma, traducir respetando el sentido.
2. Detectar ubicación de la empresa → 'letter' si es US/Canada, 'a4' para el resto.
3. Extraer 15-20 keywords del JD (skills, herramientas, frameworks, standards, métricas).
4. Reescribir el "summary" en 3-4 líneas con las top 5 keywords del JD distribuidas naturalmente.
5. Construir "competencies" — 6-10 frases keyword-dense extraídas del JD que el candidato puede defender con su experiencia real.
6. Reordenar "experience" cronológicamente inverso, y dentro de cada rol, ORDENAR los bullets por relevancia al JD (los más relevantes primero).
7. Reformular cada bullet inyectando vocabulario del JD donde tenga sentido (sin inventar).
8. Seleccionar top 3-4 "projects" más relevantes para el JD.
9. Conservar "education" y "certifications" tal cual (solo reformular descripciones si aplica).
10. Calcular "keywordCoverage": % de keywords del JD (de las 15-20 extraídas) que aparecen en el CV adaptado. Devolver como número 0-100.

Output: schema Zod estricto con todos los campos.`;

export async function generateTailoredCv(input: GenerateTailoredCvInput) {
  const userPrompt = [
    `## Empresa: ${input.company}`,
    `## Rol: ${input.role}`,
    input.jdLocationHint ? `## Ubicación hint: ${input.jdLocationHint}` : '',
    '',
    '## CV master del candidato (fuente de verdad — NO INVENTAR fuera de esto)',
    input.cvMd,
    '',
    '## Job Description',
    input.jd,
  ].filter(Boolean).join('\n');

  return callGemini<TailoredCv>({
    model: pickModel('pro'),
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: TailoredCvSchema,
    userId: input.userId,
    applicationId: input.applicationId,
  });
}

// Renders the structured CV as markdown for inline preview in the dashboard.
// This is what the user sees rendered on the page (parallel to the .docx download).
export function renderTailoredCvMd(cv: TailoredCv, profile: {
  fullName: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  linkedin?: string | null;
  portfolioUrl?: string | null;
}): string {
  const L = cv.language === 'es' ? {
    summary: 'Resumen Profesional',
    competencies: 'Competencias Clave',
    experience: 'Experiencia Laboral',
    projects: 'Proyectos',
    education: 'Formación Académica',
    certifications: 'Certificaciones',
    skills: 'Habilidades',
  } : {
    summary: 'Professional Summary',
    competencies: 'Core Competencies',
    experience: 'Work Experience',
    projects: 'Projects',
    education: 'Education',
    certifications: 'Certifications',
    skills: 'Skills',
  };

  const contactLine = [profile.email, profile.phone, profile.location, profile.linkedin, profile.portfolioUrl]
    .filter(Boolean)
    .join(' · ');

  const out: string[] = [];
  out.push(`# ${profile.fullName}`);
  out.push('');
  out.push(`_${contactLine}_`);
  out.push('');
  out.push('---');
  out.push('');
  out.push(`## ${L.summary}`);
  out.push('');
  out.push(cv.summary);
  out.push('');

  if (cv.competencies.length > 0) {
    out.push(`## ${L.competencies}`);
    out.push('');
    out.push(cv.competencies.join(' · '));
    out.push('');
  }

  out.push(`## ${L.experience}`);
  out.push('');
  for (const job of cv.experience) {
    out.push(`### ${job.role} — ${job.company}`);
    out.push(`_${job.period}${job.location ? ` · ${job.location}` : ''}_`);
    out.push('');
    for (const b of job.bullets) out.push(`- ${b}`);
    out.push('');
  }

  if (cv.projects.length > 0) {
    out.push(`## ${L.projects}`);
    out.push('');
    for (const p of cv.projects) {
      out.push(`### ${p.title}`);
      out.push(p.summary);
      out.push('');
      for (const b of p.bullets) out.push(`- ${b}`);
      out.push('');
    }
  }

  if (cv.education.length > 0) {
    out.push(`## ${L.education}`);
    out.push('');
    for (const e of cv.education) {
      out.push(`**${e.degree}**`);
      out.push(`${e.institution} · ${e.period}`);
      if (e.details) out.push(e.details);
      out.push('');
    }
  }

  if (cv.certifications.length > 0) {
    out.push(`## ${L.certifications}`);
    out.push('');
    for (const c of cv.certifications) {
      const ext = `${c.issuer ? ` — ${c.issuer}` : ''}${c.year ? ` (${c.year})` : ''}`;
      out.push(`- ${c.name}${ext}`);
    }
    out.push('');
  }

  if (cv.skills.length > 0) {
    out.push(`## ${L.skills}`);
    out.push('');
    out.push(cv.skills.join(' · '));
    out.push('');
  }

  return out.join('\n');
}

// Renders the structured CV into an HTML string that matches the template's
// placeholders. Kept for backwards compat if HTML rendering is needed.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderExperience(experience: TailoredCv['experience']): string {
  return experience.map((e) => `
    <div class="job">
      <div class="job-header">
        <span class="job-company">${escapeHtml(e.company)}</span>
        <span class="job-period">${escapeHtml(e.period)}${e.location ? ` · ${escapeHtml(e.location)}` : ''}</span>
      </div>
      <div class="job-role">${escapeHtml(e.role)}</div>
      <ul>${e.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
    </div>`).join('\n');
}

function renderProjects(projects: TailoredCv['projects']): string {
  if (projects.length === 0) return '';
  return projects.map((p) => `
    <div class="project">
      <div class="project-title">${escapeHtml(p.title)}</div>
      <div class="project-summary">${escapeHtml(p.summary)}</div>
      ${p.bullets.length > 0 ? `<ul>${p.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
    </div>`).join('\n');
}

function renderEducation(education: TailoredCv['education']): string {
  return education.map((e) => `
    <div class="edu">
      <div class="edu-degree">${escapeHtml(e.degree)}</div>
      <div class="edu-meta">${escapeHtml(e.institution)} · ${escapeHtml(e.period)}</div>
      ${e.details ? `<div class="edu-details">${escapeHtml(e.details)}</div>` : ''}
    </div>`).join('\n');
}

function renderCertifications(certifications: TailoredCv['certifications']): string {
  if (certifications.length === 0) return '';
  return `<ul class="cert-list">${certifications.map((c) => `<li>${escapeHtml(c.name)}${c.issuer ? ` — ${escapeHtml(c.issuer)}` : ''}${c.year ? ` (${escapeHtml(c.year)})` : ''}</li>`).join('')}</ul>`;
}

export function renderTailoredCvFields(cv: TailoredCv, profile: {
  fullName: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  linkedin?: string | null;
  portfolioUrl?: string | null;
}) {
  const labels = cv.language === 'es' ? {
    summary: 'Resumen Profesional',
    competencies: 'Competencias Clave',
    experience: 'Experiencia Laboral',
    projects: 'Proyectos',
    education: 'Formación Académica',
    certifications: 'Certificaciones',
    skills: 'Habilidades',
  } : {
    summary: 'Professional Summary',
    competencies: 'Core Competencies',
    experience: 'Work Experience',
    projects: 'Projects',
    education: 'Education',
    certifications: 'Certifications',
    skills: 'Skills',
  };

  return {
    LANG: cv.language,
    PAGE_WIDTH: cv.paperFormat === 'letter' ? '8.5in' : '210mm',
    NAME: escapeHtml(profile.fullName),
    EMAIL: escapeHtml(profile.email),
    PHONE: profile.phone ? escapeHtml(profile.phone) : '',
    LOCATION: profile.location ? escapeHtml(profile.location) : '',
    LINKEDIN_URL: profile.linkedin ? escapeHtml(profile.linkedin) : '',
    LINKEDIN_DISPLAY: profile.linkedin ? escapeHtml(profile.linkedin.replace(/^https?:\/\//, '')) : '',
    PORTFOLIO_URL: profile.portfolioUrl ? escapeHtml(profile.portfolioUrl) : '',
    PORTFOLIO_DISPLAY: profile.portfolioUrl ? escapeHtml(profile.portfolioUrl.replace(/^https?:\/\//, '')) : '',
    SECTION_SUMMARY: labels.summary,
    SUMMARY_TEXT: escapeHtml(cv.summary),
    SECTION_COMPETENCIES: labels.competencies,
    COMPETENCIES: cv.competencies.map((c) => `<span class="competency-tag">${escapeHtml(c)}</span>`).join(' '),
    SECTION_EXPERIENCE: labels.experience,
    EXPERIENCE: renderExperience(cv.experience),
    SECTION_PROJECTS: labels.projects,
    PROJECTS: renderProjects(cv.projects),
    SECTION_EDUCATION: labels.education,
    EDUCATION: renderEducation(cv.education),
    SECTION_CERTIFICATIONS: labels.certifications,
    CERTIFICATIONS: renderCertifications(cv.certifications),
    SECTION_SKILLS: labels.skills,
    SKILLS: cv.skills.length > 0 ? cv.skills.map((s) => escapeHtml(s)).join(' · ') : '',
  };
}
