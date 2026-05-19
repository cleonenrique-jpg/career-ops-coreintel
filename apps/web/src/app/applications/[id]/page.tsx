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
    score: string | null; status: ApplicationStatus; pdf_url: string | null;
    url: string | null; notes: string | null;
  };
  report?: { content_md: string } | null;
}

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AppDetail | null>(null);

  async function load() {
    const res = await api.get<AppDetail>(`/api/applications/${id}`);
    setData(res);
  }

  useEffect(() => { load(); }, [id]);

  async function updateStatus(status: ApplicationStatus) {
    await api.patch(`/api/applications/${id}`, { status });
    await load();
  }

  if (!data) return <p className="text-gris-500">Cargando…</p>;
  const a = data.application;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-intel-700">{a.company}</h1>
          <p className="text-text-muted">{a.role}</p>
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className="text-gris-500">#{a.num} · {a.date}</span>
            <StatusBadge status={a.status} />
            {a.score && <span className="font-semibold text-core-700">{a.score}/5</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {APPLICATION_STATUSES.map((s) => (
            <Button key={s} variant={s === a.status ? 'primary' : 'ghost'} onClick={() => updateStatus(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>

      {a.url && (
        <Card>
          <div className="text-sm text-gris-500">Source URL</div>
          <a className="text-core-700 hover:underline break-all" href={a.url} target="_blank" rel="noreferrer">{a.url}</a>
        </Card>
      )}

      {a.pdf_url && (
        <Card>
          <a className="text-core-700 hover:underline" href={a.pdf_url} target="_blank" rel="noreferrer">📄 Open generated CV PDF</a>
        </Card>
      )}

      {data.report && (
        <Card>
          <div className="prose-coreintel max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.report.content_md}</ReactMarkdown>
          </div>
        </Card>
      )}
    </div>
  );
}
