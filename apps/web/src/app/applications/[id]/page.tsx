'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Section } from '@/components/Section';
import { StatusBadge, STATUS_LABEL_ES } from '@/components/StatusBadge';
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
    try {
      await api.post(`/api/applications/${id}/prep`, {});
      alert('Prep encolado. Recargá en ~1 minuto.');
    } catch (e) {
      alert(`No se pudo encolar: ${(e as Error).message}`);
    } finally {
      setGeneratingPrep(false);
    }
  }

  async function generateTailoredCv() {
    setGeneratingCv(true);
    try {
      await api.post(`/api/applications/${id}/cv-tailored`, {});
      alert('Generación de CV adaptado encolada. Recargá en ~1-2 minutos.');
    } catch (e) {
      alert(`No se pudo encolar: ${(e as Error).message}`);
    } finally {
      setGeneratingCv(false);
    }
  }

  function downloadPrepMd() {
    if (!prep || !data) return;
    const a = data.application;
    const slug = `${a.company}-${a.role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const blob = new Blob([prep.contentMd], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `playbook-${slug}-${a.date}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function updateStatus(status: ApplicationStatus) {
    await api.patch(`/api/applications/${id}`, { status });
    await load();
  }

  async function reevaluate() {
    if (!data?.application.url) {
      alert('Esta aplicación no tiene URL guardada. Agregala al pipeline manualmente.');
      return;
    }
    setReevaluating(true);
    try {
      const r = await api.post<{ item: { id: string } }>('/api/pipeline', {
        url: data.application.url,
        company: data.application.company,
        title: data.application.role,
      });
      const pipelineUrlId = r.item?.id;
      if (!pipelineUrlId) {
        alert('No se pudo agregar al pipeline (probablemente ya está procesada).');
        return;
      }
      await api.post('/api/pipeline/evaluate', { ids: [pipelineUrlId] });
      alert('Re-evaluación encolada. Revisá en unos minutos.');
    } finally {
      setReevaluating(false);
    }
  }

  if (!data) return <p className="text-gris-500">Cargando…</p>;
  const a = data.application;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-lg font-bold text-intel-700 leading-tight">{a.company}</h1>
          <p className="text-text-muted text-xs">{a.role}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
            <span className="text-gris-500">#{a.num} · {a.date}</span>
            <StatusBadge status={a.status} />
            {a.score && <span className="font-semibold text-core-700">{a.score}/5</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:max-w-[60%] lg:justify-end">
          {APPLICATION_STATUSES.map((s) => (
            <Button
              key={s}
              variant={s === a.status ? 'primary' : 'ghost'}
              onClick={() => updateStatus(s)}
              className="text-xs"
            >
              {STATUS_LABEL_ES[s]}
            </Button>
          ))}
        </div>
      </div>

      {a.notes && (
        <Section id="notas" title="Notas" defaultOpen={true}>
          <Card>
            <p className="text-negro/90 leading-relaxed">{a.notes}</p>
          </Card>
        </Section>
      )}

      {(a.url || a.pdfUrl) && (
        <Section id="fuente" title="Fuente y CV anterior" defaultOpen={false}>
          <div className="grid md:grid-cols-2 gap-4">
            {a.url && (
              <Card>
                <div className="text-sm text-gris-500 mb-1">Fuente</div>
                <a className="text-core-700 hover:underline break-all text-sm" href={a.url} target="_blank" rel="noreferrer">{a.url}</a>
              </Card>
            )}
            {a.pdfUrl && (
              <Card>
                <div className="text-sm text-gris-500 mb-1">CV anterior (sin adaptar al JD)</div>
                <a className="text-core-700 hover:underline" href={a.pdfUrl} target="_blank" rel="noreferrer">📄 Abrir PDF</a>
              </Card>
            )}
          </div>
        </Section>
      )}

      <Section id="report" title="Evaluación del rol" subtitle="Reporte detallado de match candidato ↔ JD generado por Gemini." defaultOpen={true}>
        {data.report ? (
          <Card>
            <div className="prose-coreintel max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.report.contentMd}</ReactMarkdown>
            </div>
          </Card>
        ) : (
          <Card className="text-center py-8">
            <p className="text-gris-500 mb-3">Esta aplicación no tiene un report detallado todavía.</p>
            {a.url && (
              <Button onClick={reevaluate} disabled={reevaluating}>
                {reevaluating ? 'Encolando…' : '🔄 Re-evaluar con Gemini'}
              </Button>
            )}
          </Card>
        )}
      </Section>

      <Section id="cv-tailored" title="CV adaptado al JD" subtitle="Versión del CV reescrita con keywords del JD, bullets reordenados por relevancia y formato ATS-friendly. Descarga como .docx para editar antes de enviar.">
        {tailoredCv ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gris-300/60">
              <div className="text-sm">
                <div className="text-gris-500 text-xs mb-1">
                  Generado {new Date(tailoredCv.generatedAt).toLocaleString()}
                </div>
                {tailoredCv.keywordCoverage && (
                  <div className="text-intel-700 font-semibold">
                    Cobertura de keywords del JD: {tailoredCv.keywordCoverage}%
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {tailoredCv.fileUrl && (
                  <a href={tailoredCv.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-gris-300 hover:bg-intel-50">
                    <Icon name="download" size={14} /> Descargar Word
                  </a>
                )}
                {STATUS_BEFORE_APPLIED.includes(a.status) && a.url && (
                  <Button variant="ghost" onClick={generateTailoredCv} disabled={generatingCv} className="text-sm">
                    {generatingCv ? 'Encolando…' : 'Regenerar'}
                  </Button>
                )}
              </div>
            </div>
            <div className="prose-coreintel max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{tailoredCv.contentMd}</ReactMarkdown>
            </div>
          </Card>
        ) : STATUS_BEFORE_APPLIED.includes(a.status) ? (
          <Card className="text-center py-8">
            <p className="text-gris-500 mb-3">Generá una versión del CV adaptada a esta oferta antes de aplicar.</p>
            {a.url ? (
              <Button onClick={generateTailoredCv} disabled={generatingCv}>
                {generatingCv ? 'Encolando…' : 'Generar CV adaptado'}
              </Button>
            ) : (
              <p className="text-xs text-gris-500">Necesitás una URL de oferta para extraer el JD.</p>
            )}
          </Card>
        ) : (
          <Card className="text-center py-6">
            <p className="text-gris-500 text-sm">El CV adaptado se genera antes de aplicar (status Evaluated).</p>
          </Card>
        )}
      </Section>

      <Section id="prep" title="Playbook operativo del rol" subtitle="Qué hace un profesional senior para ejecutar cada responsabilidad del JD." defaultOpen={true}>
        {prep ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="text-xs text-gris-500">
                Generado {new Date(prep.generatedAt).toLocaleString()}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={downloadPrepMd} className="text-xs">
                  Descargar .md
                </Button>
                {prep.fileUrl && (
                  <a href={prep.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs px-3 py-1.5 rounded border border-gris-300 hover:bg-intel-50">
                    Descargar Word
                  </a>
                )}
              </div>
            </div>
            <div className="prose-coreintel max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{prep.contentMd}</ReactMarkdown>
            </div>
            {a.url && (
              <div className="mt-4 pt-4 border-t border-gris-300/60">
                <Button variant="ghost" onClick={generatePrep} disabled={generatingPrep}>
                  {generatingPrep ? 'Encolando…' : 'Regenerar playbook'}
                </Button>
              </div>
            )}
          </Card>
        ) : a.status === 'Interview' || a.status === 'Responded' ? (
          <Card className="text-center py-8">
            <p className="text-gris-500 mb-3">Generá el playbook operativo a partir del JD.</p>
            {a.url ? (
              <Button onClick={generatePrep} disabled={generatingPrep}>
                {generatingPrep ? 'Encolando…' : 'Generar playbook'}
              </Button>
            ) : (
              <p className="text-xs text-gris-500">Necesitás una URL de oferta para extraer el JD.</p>
            )}
          </Card>
        ) : (
          <Card className="text-center py-6">
            <p className="text-gris-500 text-sm">Disponible una vez confirmada la entrevista (status Interview o Responded).</p>
          </Card>
        )}
      </Section>
    </div>
  );
}
