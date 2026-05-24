'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '@/lib/api';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@career-ops/shared';

interface AppDetail {
  application: {
    id: string; num: number; date: string; company: string; role: string;
    score: string | null; status: ApplicationStatus; pdfUrl: string | null;
    url: string | null; notes: string | null;
  };
  report?: { contentMd: string } | null;
}

interface PrepData {
  prep: { contentMd: string; generatedAt: string; fileUrl: string | null } | null;
}

interface CvTailoredData {
  cv: { id: string; contentMd: string; fileUrl: string | null; keywordCoverage: string | null; generatedAt: string } | null;
}

const STATUS_PILL: Record<ApplicationStatus, { bg: string; text: string; label: string }> = {
  Evaluated: { bg: 'bg-[#F3F3F1]', text: 'text-gris-500',  label: 'Pendiente' },
  Applied:   { bg: 'bg-[#E1F3FE]', text: 'text-[#1F6C9F]', label: 'Aplicada' },
  Responded: { bg: 'bg-[#FBF3DB]', text: 'text-[#7a5d00]', label: 'Contactada' },
  Interview: { bg: 'bg-[#FDE9D7]', text: 'text-[#a85100]', label: 'Entrevista' },
  Offer:     { bg: 'bg-[#EDF3EC]', text: 'text-[#346538]', label: 'Oferta' },
  Rejected:  { bg: 'bg-[#FDEBEC]', text: 'text-[#9F2F2D]', label: 'Rechazada' },
  Discarded: { bg: 'bg-[#F3F3F1]', text: 'text-gris-500',  label: 'Descartada' },
  SKIP:      { bg: 'bg-[#F3F3F1]', text: 'text-gris-500',  label: 'Skip' },
};

const STATUS_LABEL_ES: Record<ApplicationStatus, string> = {
  Evaluated: 'Pendiente', Applied: 'Aplicada', Responded: 'Contactada',
  Interview: 'Entrevista', Offer: 'Oferta', Rejected: 'Rechazada',
  Discarded: 'Descartada', SKIP: 'Skip',
};

function scoreColor(score: number | null): string {
  if (score == null) return 'text-gris-300';
  if (score >= 4.0) return 'text-[#346538]';
  if (score >= 3.0) return 'text-[#a85100]';
  return 'text-[#9F2F2D]';
}

const STATUS_BEFORE_APPLIED: ApplicationStatus[] = ['Evaluated'];

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AppDetail | null>(null);
  const [prep, setPrep] = useState<PrepData['prep']>(null);
  const [tailoredCv, setTailoredCv] = useState<CvTailoredData['cv']>(null);
  const [reevaluating, setReevaluating] = useState(false);
  const [generatingPrep, setGeneratingPrep] = useState(false);
  const [generatingCv, setGeneratingCv] = useState(false);

  async function load() {
    const [detail, prepRes, cvRes] = await Promise.all([
      api.get<AppDetail>(`/api/applications/${id}`),
      api.get<PrepData>(`/api/applications/${id}/prep`),
      api.get<CvTailoredData>(`/api/applications/${id}/cv-tailored`),
    ]);
    setData(detail);
    setPrep(prepRes.prep);
    setTailoredCv(cvRes.cv);
  }

  useEffect(() => { load(); }, [id]);

  async function generatePrep() {
    setGeneratingPrep(true);
    try { await api.post(`/api/applications/${id}/prep`, {}); alert('Prep encolado. Recargá en ~1 min.'); }
    catch (e) { alert(`No se pudo encolar: ${(e as Error).message}`); }
    finally { setGeneratingPrep(false); }
  }

  async function generateTailoredCv() {
    setGeneratingCv(true);
    try { await api.post(`/api/applications/${id}/cv-tailored`, {}); alert('CV adaptado encolado. Recargá en ~1-2 min.'); }
    catch (e) { alert(`No se pudo encolar: ${(e as Error).message}`); }
    finally { setGeneratingCv(false); }
  }

  function downloadPrepMd() {
    if (!prep || !data) return;
    const a = data.application;
    const slug = `${a.company}-${a.role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const blob = new Blob([prep.contentMd], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `playbook-${slug}-${a.date}.md`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function updateStatus(status: ApplicationStatus) {
    await api.patch(`/api/applications/${id}`, { status });
    await load();
  }

  async function reevaluate() {
    if (!data?.application.url) { alert('Esta aplicación no tiene URL guardada.'); return; }
    setReevaluating(true);
    try {
      const r = await api.post<{ item: { id: string } }>('/api/pipeline', {
        url: data.application.url, company: data.application.company, title: data.application.role,
      });
      const pipelineUrlId = r.item?.id;
      if (!pipelineUrlId) { alert('No se pudo agregar al pipeline.'); return; }
      await api.post('/api/pipeline/evaluate', { ids: [pipelineUrlId] });
      alert('Re-evaluación encolada.');
    } finally { setReevaluating(false); }
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] -mx-6 -my-8 px-6 py-12">
        <p className="text-gris-500 text-center mt-12">Cargando…</p>
      </div>
    );
  }

  const a = data.application;
  const scoreNum = a.score ? Number(a.score) : null;
  const pill = STATUS_PILL[a.status];

  return (
    <div className="editorial-font min-h-screen bg-[#FBFBFA] -mx-6 -my-8 px-6 py-12 md:px-12 md:py-16">
      <div className="max-w-4xl mx-auto space-y-12">

        {/* Breadcrumb back */}
        <Link href="/preview" className="inline-block text-xs uppercase tracking-[0.15em] text-gris-500 hover:text-intel-700 transition">
          ← Pipeline
        </Link>

        {/* Header editorial */}
        <header className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium font-mono">
            Aplicación #{a.num} · {new Date(a.date).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-intel-700 tracking-[-0.02em] leading-[1.05]">
            {a.company}
          </h1>
          <p className="text-xl text-gris-500 leading-relaxed">{a.role}</p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <span className={`inline-block rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] font-semibold ${pill.bg} ${pill.text}`}>
              {pill.label}
            </span>
            {scoreNum != null && (
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Score</span>
                <span className={`text-3xl font-bold tabular-nums tracking-[-0.02em] ${scoreColor(scoreNum)}`}>
                  {scoreNum.toFixed(1)}
                </span>
                <span className="text-sm text-gris-500">/ 5</span>
              </div>
            )}
            {a.url && (
              <a href={a.url} target="_blank" rel="noreferrer" className="ml-auto text-sm text-intel-700 hover:underline">
                Ver oferta original ↗
              </a>
            )}
          </div>
        </header>

        {/* Status changer */}
        <section>
          <div className="text-[10px] uppercase tracking-[0.18em] text-gris-500 font-medium mb-3">
            Cambiar estado
          </div>
          <div className="flex flex-wrap gap-2">
            {APPLICATION_STATUSES.map((s) => {
              const isActive = s === a.status;
              return (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition active:scale-[0.98] ${
                    isActive
                      ? 'bg-intel-700 text-white border-intel-700'
                      : 'border-[#EAEAEA] text-gris-500 hover:border-intel-700 hover:text-intel-700'
                  }`}
                >
                  {STATUS_LABEL_ES[s]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Notas */}
        {a.notes && (
          <section className="bg-white border border-[#EAEAEA] rounded-xl p-8">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gris-500 font-medium mb-4">
              Notas de evaluación
            </div>
            <p className="text-base text-intel-700 leading-relaxed">{a.notes}</p>
          </section>
        )}

        {/* Fuente y CV anterior */}
        {(a.url || a.pdfUrl) && (
          <section className="grid md:grid-cols-2 gap-4">
            {a.url && (
              <div className="bg-white border border-[#EAEAEA] rounded-xl p-6">
                <div className="text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-2">
                  Fuente
                </div>
                <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-intel-700 hover:underline break-all font-mono">
                  {a.url}
                </a>
              </div>
            )}
            {a.pdfUrl && (
              <div className="bg-white border border-[#EAEAEA] rounded-xl p-6">
                <div className="text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-2">
                  CV anterior (sin adaptar)
                </div>
                <a href={a.pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-intel-700 hover:underline">
                  Abrir PDF ↗
                </a>
              </div>
            )}
          </section>
        )}

        {/* Evaluación */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-intel-700 tracking-[-0.02em] mb-2">
              Evaluación del rol
            </h2>
            <p className="text-sm text-gris-500 leading-relaxed">
              Reporte detallado de match candidato ↔ JD generado por Gemini.
            </p>
          </div>
          {data.report ? (
            <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 md:p-10">
              <div className="prose-coreintel max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.report.contentMd}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#EAEAEA] rounded-xl p-10 text-center">
              <p className="text-gris-500 text-sm mb-4">Esta aplicación no tiene reporte detallado todavía.</p>
              {a.url && (
                <button
                  onClick={reevaluate}
                  disabled={reevaluating}
                  className="px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
                >
                  {reevaluating ? 'Encolando…' : 'Re-evaluar con Gemini'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* CV adaptado */}
        <section id="cv-tailored">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-intel-700 tracking-[-0.02em] mb-2">
              CV adaptado al JD
            </h2>
            <p className="text-sm text-gris-500 leading-relaxed max-w-2xl">
              Versión del CV reescrita con keywords del JD, bullets reordenados por relevancia y formato ATS-friendly. Descargá como .docx para editar antes de enviar.
            </p>
          </div>

          {tailoredCv ? (
            <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-5 border-b border-[#F3F3F1]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-1">
                    Generado
                  </div>
                  <div className="text-xs text-gris-500 font-mono">
                    {new Date(tailoredCv.generatedAt).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {tailoredCv.keywordCoverage && (
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">
                        Cobertura keywords JD
                      </span>
                      <span className="text-2xl font-bold text-intel-700 tabular-nums tracking-[-0.02em]">
                        {tailoredCv.keywordCoverage}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {tailoredCv.fileUrl && (
                    <a
                      href={tailoredCv.fileUrl} target="_blank" rel="noreferrer"
                      className="px-4 py-2 text-xs font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition"
                    >
                      Descargar Word
                    </a>
                  )}
                  {STATUS_BEFORE_APPLIED.includes(a.status) && a.url && (
                    <button
                      onClick={generateTailoredCv}
                      disabled={generatingCv}
                      className="px-4 py-2 text-xs font-medium rounded-md border border-[#EAEAEA] text-intel-700 hover:bg-[#F5F5F7] active:scale-[0.98] transition"
                    >
                      {generatingCv ? 'Encolando…' : 'Regenerar'}
                    </button>
                  )}
                </div>
              </div>
              <div className="p-8 md:p-10">
                <div className="prose-coreintel max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{tailoredCv.contentMd}</ReactMarkdown>
                </div>
              </div>
            </div>
          ) : STATUS_BEFORE_APPLIED.includes(a.status) ? (
            <div className="bg-white border border-[#EAEAEA] rounded-xl p-10 text-center">
              <p className="text-gris-500 text-sm mb-4">Generá una versión del CV adaptada a esta oferta antes de aplicar.</p>
              {a.url ? (
                <button
                  onClick={generateTailoredCv}
                  disabled={generatingCv}
                  className="px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
                >
                  {generatingCv ? 'Encolando…' : 'Generar CV adaptado'}
                </button>
              ) : (
                <p className="text-xs text-gris-500">Necesitás una URL de oferta para extraer el JD.</p>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 text-center">
              <p className="text-gris-500 text-sm">El CV adaptado se genera antes de aplicar (status Pendiente).</p>
            </div>
          )}
        </section>

        {/* Playbook */}
        <section id="prep">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-intel-700 tracking-[-0.02em] mb-2">
              Playbook operativo
            </h2>
            <p className="text-sm text-gris-500 leading-relaxed max-w-2xl">
              Qué hace un profesional senior para ejecutar cada responsabilidad del JD.
            </p>
          </div>

          {prep ? (
            <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-5 border-b border-[#F3F3F1]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-1">
                    Generado
                  </div>
                  <div className="text-xs text-gris-500 font-mono">
                    {new Date(prep.generatedAt).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex gap-2">
                  {prep.fileUrl && (
                    <a
                      href={prep.fileUrl} target="_blank" rel="noreferrer"
                      className="px-4 py-2 text-xs font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition"
                    >
                      Descargar Word
                    </a>
                  )}
                  <button
                    onClick={downloadPrepMd}
                    className="px-4 py-2 text-xs font-medium rounded-md border border-[#EAEAEA] text-intel-700 hover:bg-[#F5F5F7] active:scale-[0.98] transition"
                  >
                    Descargar .md
                  </button>
                  {a.url && (
                    <button
                      onClick={generatePrep}
                      disabled={generatingPrep}
                      className="px-4 py-2 text-xs font-medium rounded-md border border-[#EAEAEA] text-gris-500 hover:bg-[#F5F5F7] hover:text-intel-700 active:scale-[0.98] transition"
                    >
                      {generatingPrep ? 'Encolando…' : 'Regenerar'}
                    </button>
                  )}
                </div>
              </div>
              <div className="p-8 md:p-10">
                <div className="prose-coreintel max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{prep.contentMd}</ReactMarkdown>
                </div>
              </div>
            </div>
          ) : a.status === 'Interview' || a.status === 'Responded' ? (
            <div className="bg-white border border-[#EAEAEA] rounded-xl p-10 text-center">
              <p className="text-gris-500 text-sm mb-4">Generá el playbook operativo a partir del JD.</p>
              {a.url ? (
                <button
                  onClick={generatePrep}
                  disabled={generatingPrep}
                  className="px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
                >
                  {generatingPrep ? 'Encolando…' : 'Generar playbook'}
                </button>
              ) : (
                <p className="text-xs text-gris-500">Necesitás una URL de oferta para extraer el JD.</p>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 text-center">
              <p className="text-gris-500 text-sm">Disponible una vez confirmada la entrevista (Contactada / Entrevista).</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
