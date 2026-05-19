// Consumes tailor-cv jobs — fetches JD, calls Gemini generateTailoredCv,
// builds a Word (.docx) document from the structured output, uploads to
// Supabase Storage, persists into cv_tailored.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, LevelFormat,
} from 'docx';
import { boss, QUEUES, type TailorCvJobData } from './lib/queue.js';
import { fetchJd, shutdownBrowser } from './lib/fetchJd.js';
import { uploadFile } from './lib/storage.js';
import { db, applications, profiles, cvs, cvTailored } from '@career-ops/db';
import { generateTailoredCv, renderTailoredCvMd, type TailoredCv } from '@career-ops/gemini';
import { and, desc, eq } from 'drizzle-orm';

const CORE_CYAN = '0d4f5c';
const ACCENT_PURPLE = '5b3a8a';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function labels(lang: 'en' | 'es') {
  return lang === 'es' ? {
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
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { color: CORE_CYAN, space: 4, style: BorderStyle.SINGLE, size: 8 } },
    children: [new TextRun({
      text: text.toUpperCase(),
      bold: true,
      color: CORE_CYAN,
      size: 22,
      font: 'Calibri',
    })],
  });
}

function body(text: string, opts: { bold?: boolean; color?: string; size?: number; italic?: boolean } = {}): TextRun {
  return new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italic,
    color: opts.color,
    size: opts.size ?? 20,
    font: 'Calibri',
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    numbering: { reference: 'cv-bullets', level: 0 },
    children: [body(text)],
  });
}

function buildDocx(cv: TailoredCv, profile: {
  fullName: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  linkedin?: string | null;
  portfolioUrl?: string | null;
}): Document {
  const L = labels(cv.language);

  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.location) contactParts.push(profile.location);
  if (profile.linkedin) contactParts.push(profile.linkedin);
  if (profile.portfolioUrl) contactParts.push(profile.portfolioUrl);

  const children: Paragraph[] = [];

  // Header
  children.push(new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 60 },
    children: [new TextRun({ text: profile.fullName, bold: true, color: CORE_CYAN, size: 44, font: 'Calibri' })],
  }));
  children.push(new Paragraph({
    spacing: { after: 240 },
    border: { bottom: { color: ACCENT_PURPLE, space: 4, style: BorderStyle.SINGLE, size: 12 } },
    children: [body(contactParts.join('  ·  '), { color: '666666', size: 18 })],
  }));

  // Summary
  children.push(sectionHeading(L.summary));
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [body(cv.summary)],
  }));

  // Competencies — single paragraph, separated by '·'
  if (cv.competencies.length > 0) {
    children.push(sectionHeading(L.competencies));
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [body(cv.competencies.join('  ·  '), { color: ACCENT_PURPLE, bold: true })],
    }));
  }

  // Experience
  children.push(sectionHeading(L.experience));
  for (const job of cv.experience) {
    children.push(new Paragraph({
      spacing: { before: 160, after: 0 },
      children: [
        body(job.company, { bold: true, color: ACCENT_PURPLE, size: 22 }),
        body('    '),
        body(`${job.period}${job.location ? ` · ${job.location}` : ''}`, { color: '666666', size: 18 }),
      ],
    }));
    children.push(new Paragraph({
      spacing: { after: 80 },
      children: [body(job.role, { italic: true, color: CORE_CYAN })],
    }));
    for (const b of job.bullets) {
      children.push(bullet(b));
    }
  }

  // Projects (optional)
  if (cv.projects.length > 0) {
    children.push(sectionHeading(L.projects));
    for (const p of cv.projects) {
      children.push(new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [body(p.title, { bold: true, color: ACCENT_PURPLE })],
      }));
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [body(p.summary)],
      }));
      for (const b of p.bullets) {
        children.push(bullet(b));
      }
    }
  }

  // Education
  if (cv.education.length > 0) {
    children.push(sectionHeading(L.education));
    for (const e of cv.education) {
      children.push(new Paragraph({
        spacing: { before: 80, after: 0 },
        children: [body(e.degree, { bold: true })],
      }));
      children.push(new Paragraph({
        spacing: { after: 80 },
        children: [body(`${e.institution} · ${e.period}`, { color: '666666', size: 18 })],
      }));
      if (e.details) {
        children.push(new Paragraph({ spacing: { after: 60 }, children: [body(e.details, { size: 18 })] }));
      }
    }
  }

  // Certifications
  if (cv.certifications.length > 0) {
    children.push(sectionHeading(L.certifications));
    for (const c of cv.certifications) {
      const text = `${c.name}${c.issuer ? ` — ${c.issuer}` : ''}${c.year ? ` (${c.year})` : ''}`;
      children.push(bullet(text));
    }
  }

  // Skills
  if (cv.skills.length > 0) {
    children.push(sectionHeading(L.skills));
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [body(cv.skills.join('  ·  '))],
    }));
  }

  return new Document({
    creator: 'career-ops',
    title: `CV — ${profile.fullName}`,
    numbering: {
      config: [{
        reference: 'cv-bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 240 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
          size: cv.paperFormat === 'a4'
            ? { width: 11906, height: 16838 }
            : { width: 12240, height: 15840 },
        },
      },
      children,
    }],
  });
}

async function handleBatch(jobs: Array<{ data: TailorCvJobData }>) {
  for (const job of jobs) {
    await handleOne(job.data);
  }
}

async function handleOne(data: TailorCvJobData) {
  const { userId, applicationId } = data;

  const [app] = await db.select().from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
  if (!app) throw new Error(`application ${applicationId} not found`);
  if (!app.url) throw new Error(`application ${applicationId} has no url — cannot fetch JD`);

  const userProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!userProfile) throw new Error(`profile not found for user ${userId}`);

  const [activeCv] = await db.select().from(cvs)
    .where(and(eq(cvs.userId, userId), eq(cvs.isActive, true)))
    .orderBy(desc(cvs.createdAt)).limit(1);
  if (!activeCv) throw new Error(`no active CV for user ${userId}`);

  const fetched = await fetchJd(app.url);

  const { data: tailored } = await generateTailoredCv({
    cvMd: activeCv.contentMd,
    jd: fetched.jd,
    company: app.company,
    role: app.role,
    userId,
    applicationId,
  });

  const doc = buildDocx(tailored, {
    fullName: userProfile.fullName,
    email: userProfile.email,
    phone: userProfile.phone,
    location: userProfile.location,
    linkedin: userProfile.linkedin,
    portfolioUrl: userProfile.portfolioUrl,
  });

  const buf = await Packer.toBuffer(doc);
  const filename = `cv-tailored-${slugify(userProfile.fullName)}-${slugify(app.company)}-${app.date}.docx`;
  const fileUrl = await uploadFile(
    userId,
    filename,
    buf,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'docs',
  );

  const profileForRender = {
    fullName: userProfile.fullName,
    email: userProfile.email,
    phone: userProfile.phone,
    location: userProfile.location,
    linkedin: userProfile.linkedin,
    portfolioUrl: userProfile.portfolioUrl,
  };
  const contentMd = renderTailoredCvMd(tailored, profileForRender);

  await db.insert(cvTailored).values({
    userId,
    applicationId,
    contentMd,
    fileUrl,
    keywordCoverage: tailored.keywordCoverage.toFixed(1),
  });

  console.log(`[tailor-cv] ${app.company} | ${app.role} → coverage=${tailored.keywordCoverage.toFixed(1)}% (${fileUrl})`);
}

async function main() {
  await boss.start();
  await boss.createQueue(QUEUES.tailorCv);
  await boss.work<TailorCvJobData>(QUEUES.tailorCv, { batchSize: 1 }, handleBatch);
  console.log('[tailor-cv] ready, listening on', QUEUES.tailorCv);
}

process.on('SIGTERM', async () => { await boss.stop(); await shutdownBrowser(); process.exit(0); });
process.on('SIGINT',  async () => { await boss.stop(); await shutdownBrowser(); process.exit(0); });

main().catch((err) => { console.error('[tailor-cv] fatal:', err); process.exit(1); });
