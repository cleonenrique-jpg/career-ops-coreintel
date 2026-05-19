'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
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

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AppDetail | null>(null);
  const [reevaluating, setReevaluating] = useState(false);

  async function load() {
    const res = await api.get<AppDetail>(`/api/applications/${id}`);
    setData(res);
  }

  useEffect(() => { load(); }, [id]);

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
          <h1 className="text-h2 md:text-h1 text-intel-700">{a.company}</h1>
          <p className="text-text-muted">{a.role}</p>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
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
              {s}
            </Button>
          ))}
        </div>
      </div>

      {a.notes && (
        <Card>
          <div className="text-sm text-gris-500 mb-1">Notas</div>
          <p className="text-negro/90 leading-relaxed">{a.notes}</p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {a.url && (
          <Card>
            <div className="text-sm text-gris-500 mb-1">Fuente</div>
            <a className="text-core-700 hover:underline break-all text-sm" href={a.url} target="_blank" rel="noreferrer">{a.url}</a>
          </Card>
        )}
        {a.pdfUrl && (
          <Card>
            <div className="text-sm text-gris-500 mb-1">CV generado</div>
            <a className="text-core-700 hover:underline" href={a.pdfUrl} target="_blank" rel="noreferrer">📄 Abrir PDF</a>
          </Card>
        )}
      </div>

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
    </div>
  );
}
