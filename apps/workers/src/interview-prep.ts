// Consumes interview-prep jobs — fetches JD, calls Gemini generateInterviewPrep,
// renders markdown, persists into interview_prep, and also renders a .docx for download.

import {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, LevelFormat,
  HeadingLevel,
} from 'docx';
import { boss, QUEUES, type InterviewPrepJobData } from './lib/queue.js';
import { fetchJd, shutdownBrowser } from './lib/fetchJd.js';
import { uploadFile } from './lib/storage.js';
import { db, applications, profiles, interviewPrep } from '@career-ops/db';
import { generateInterviewPrep, renderInterviewPrep } from '@career-ops/gemini';
import { and, eq } from 'drizzle-orm';

const CORE_CYAN = '0d4f5c';
const ACCENT = '5b3a8a';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// Lightweight markdown → docx Paragraphs. Supports h1/h2/h3, blockquote,
// bulleted lists, numbered lists, simple bold/italic inline, and paragraphs.
// Anything more complex (tables) is rendered as a plain paragraph.
function mdToParagraphs(md: string): Paragraph[] {
  const lines = md.split(/\r?\n/);
  const out: Paragraph[] = [];

  const inlineRuns = (text: string, baseOpts: Partial<{ bold: boolean; italics: boolean; color: string; size: number }> = {}): TextRun[] => {
    const runs: TextRun[] = [];
    const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), ...baseOpts, size: baseOpts.size ?? 20, font: 'Calibri' }));
      const tok = m[1] ?? '';
      if (tok.startsWith('**') || tok.startsWith('__')) {
        runs.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...baseOpts, size: baseOpts.size ?? 20, font: 'Calibri' }));
      } else if (tok.startsWith('`')) {
        runs.push(new TextRun({ text: tok.slice(1, -1), font: 'Consolas', ...baseOpts, size: baseOpts.size ?? 20 }));
      } else {
        runs.push(new TextRun({ text: tok.slice(1, -1), italics: true, ...baseOpts, size: baseOpts.size ?? 20, font: 'Calibri' }));
      }
      last = m.index + tok.length;
    }
    if (last < text.length) runs.push(new TextRun({ text: text.slice(last), ...baseOpts, size: baseOpts.size ?? 20, font: 'Calibri' }));
    if (runs.length === 0) runs.push(new TextRun({ text, ...baseOpts, size: baseOpts.size ?? 20, font: 'Calibri' }));
    return runs;
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i] ?? '';
    const line = raw.replace(/\s+$/, '');
    if (line === '' || /^---+$/.test(line)) { i++; continue; }

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^# (.+)$/))) {
      out.push(new Paragraph({
        spacing: { before: 0, after: 160 },
        border: { bottom: { color: CORE_CYAN, space: 4, style: BorderStyle.SINGLE, size: 12 } },
        children: [new TextRun({ text: m[1] ?? '', bold: true, color: CORE_CYAN, size: 36, font: 'Calibri' })],
      }));
    } else if ((m = line.match(/^## (.+)$/))) {
      out.push(new Paragraph({
        spacing: { before: 280, after: 100 },
        children: [new TextRun({ text: m[1] ?? '', bold: true, color: CORE_CYAN, size: 26, font: 'Calibri' })],
      }));
    } else if ((m = line.match(/^### (.+)$/))) {
      out.push(new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: m[1] ?? '', bold: true, color: ACCENT, size: 22, font: 'Calibri' })],
      }));
    } else if ((m = line.match(/^> (.+)$/))) {
      out.push(new Paragraph({
        spacing: { before: 80, after: 120 },
        indent: { left: 360 },
        border: { left: { color: CORE_CYAN, space: 12, style: BorderStyle.SINGLE, size: 12 } },
        children: inlineRuns(m[1] ?? '', { italics: true, color: '555555' }),
      }));
    } else if ((m = line.match(/^[-*] (.+)$/))) {
      out.push(new Paragraph({
        spacing: { after: 60 },
        numbering: { reference: 'prep-bullets', level: 0 },
        children: inlineRuns(m[1] ?? ''),
      }));
    } else if ((m = line.match(/^\d+\.\s+(.+)$/))) {
      out.push(new Paragraph({
        spacing: { after: 60 },
        numbering: { reference: 'prep-numbers', level: 0 },
        children: inlineRuns(m[1] ?? ''),
      }));
    } else if (line.includes('|') && lines[i + 1]?.match(/^\s*\|?\s*[-:|\s]+\|/)) {
      // Skip markdown tables — render as paragraph block of joined rows
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]?.includes('|')) {
        tableLines.push((lines[i] ?? '').replace(/^\||\|$/g, '').trim());
        i++;
      }
      for (const tl of tableLines) {
        if (/^[-:|\s]+$/.test(tl)) continue;
        out.push(new Paragraph({ spacing: { after: 40 }, children: inlineRuns(tl.replace(/\s*\|\s*/g, ' · ')) }));
      }
      continue;
    } else {
      out.push(new Paragraph({ spacing: { after: 100 }, children: inlineRuns(line) }));
    }
    i++;
  }
  return out;
}

function buildPlaybookDocx(contentMd: string, title: string): Document {
  const paragraphs = mdToParagraphs(contentMd);
  return new Document({
    creator: 'career-ops',
    title,
    numbering: {
      config: [
        {
          reference: 'prep-bullets',
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } },
          }],
        },
        {
          reference: 'prep-numbers',
          levels: [{
            level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 280 } } },
          }],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
          size: { width: 12240, height: 15840 },
        },
      },
      children: paragraphs,
    }],
  });
}

async function handleBatch(jobs: Array<{ data: InterviewPrepJobData }>) {
  for (const job of jobs) {
    await handleOne(job.data);
  }
}

async function handleOne(data: InterviewPrepJobData) {
  const { userId, applicationId } = data;

  const [app] = await db.select().from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
  if (!app) throw new Error(`application ${applicationId} not found`);
  if (!app.url) throw new Error(`application ${applicationId} has no url — cannot fetch JD`);

  const userProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!userProfile) throw new Error(`profile not found for user ${userId}`);

  const fetched = await fetchJd(app.url);

  const { data: prep } = await generateInterviewPrep({
    jd: fetched.jd,
    company: app.company,
    role: app.role,
    profileNarrative: userProfile.narrative ?? '',
    userId,
    applicationId,
  });

  const contentMd = renderInterviewPrep(prep, app.company, app.role);

  const doc = buildPlaybookDocx(contentMd, `Playbook — ${app.company}`);
  const buf = await Packer.toBuffer(doc);
  const filename = `playbook-${slugify(app.company)}-${slugify(app.role)}-${app.date}.docx`;
  const fileUrl = await uploadFile(
    userId,
    filename,
    buf,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'docs',
  );

  await db.insert(interviewPrep).values({
    userId,
    applicationId,
    contentMd,
    fileUrl,
  });

  console.log(`[interview-prep] ${app.company} | ${app.role} → prep + docx generated (${fileUrl})`);
}

async function main() {
  await boss.start();
  await boss.createQueue(QUEUES.interviewPrep);
  await boss.work<InterviewPrepJobData>(QUEUES.interviewPrep, { batchSize: 2 }, handleBatch);
  console.log('[interview-prep] ready, listening on', QUEUES.interviewPrep);
}

process.on('SIGTERM', async () => { await boss.stop(); await shutdownBrowser(); process.exit(0); });
process.on('SIGINT',  async () => { await boss.stop(); await shutdownBrowser(); process.exit(0); });

main().catch((err) => { console.error('[interview-prep] fatal:', err); process.exit(1); });
