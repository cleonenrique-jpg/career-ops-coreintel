'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatsCard } from '@/components/StatsCard';
import { FilterChip } from '@/components/FilterChip';
import { Timeline, buildTimeline } from '@/components/Timeline';
import { RowMenu } from '@/components/RowMenu';
import { api } from '@/lib/api';
import { type ApplicationStatus } from '@career-ops/shared';

interface AppRow {
  id: string;
  num: number;
  date: string;
  company: string;
  role: string;
  score: string | null;
  status: ApplicationStatus;
  pdfUrl: string | null;
  url: string | null;
  notes: string | null;
  updatedAt: string;
  createdAt: string;
}

interface PipelineRow {
  id: string;
  url: string;
  company: string | null;
  title: string | null;
  status: string;
  source: string | null;
  scannedAt: string;
}

type FilterKey = 'all' | 'pending' | 'applied' | 'interview' | 'offer' | 'closed' | 'high';

const FILTERS: { key: FilterKey; label: (n: number) => string }[] = [
  { key: 'all',       label: (n) => `Todas (${n})` },
  { key: 'pending',   label: (n) => `📥 Pendientes (${n})` },
  { key: 'applied',   label: (n) => `📤 Aplicadas (${n})` },
  { key: 'interview', label: (n) => `🎤 En entrevista (${n})` },
  { key: 'offer',     label: (n) => `🎁 Ofertas (${n})` },
  { key: 'closed',    label: (n) => `❌ Cerradas (${n})` },
  { key: 'high',      label: (n) => `📊 Score ≥ 4.0 (${n})` },
];

const STATUS_BADGE: Record<ApplicationStatus, { tone: string; icon: string; label: string }> = {
  Evaluated: { tone: 'bg-gris-100 text-gris-700 border-l-gris-500',                  icon: '📥', label: 'Pendiente' },
  Applied:   { tone: 'bg-core/10 text-core-700 border-l-core',                       icon: '📤', label: 'Aplicada' },
  Responded: { tone: 'bg-amarillo/15 text-[#7a5d00] border-l-amarillo',              icon: '📞', label: 'Contactada' },
  Interview: { tone: 'bg-naranja/15 text-[#a85100] border-l-naranja',                icon: '🎤', label: 'Entrevista' },
  Offer:     { tone: 'bg-lima/20 text-[#5b6c00] border-l-lima',                      icon: '🎁', label: '¡Oferta!' },
  Rejected:  { tone: 'bg-red-100 text-red-700 border-l-red-500',                     icon: '❌', label: 'Rechazada' },
  Discarded: { tone: 'bg-gris-100 text-gris-500 border-l-gris-300',                  icon: '⏸',  label: 'Descartada' },
  SKIP:      { tone: 'bg-gris-100 text-gris-500 border-l-gris-300',                  icon: '⏸',  label: 'SKIP' },
};

function scoreClass(score: number | null): string {
  if (score == null) return 'text-gris-500';
  if (score >= 4.0) return 'text-[#5b6c00]';
  if (score >= 3.0) return 'text-naranja';
  return 'text-red-600';
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [pending, setPending] = useState<PipelineRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [a, p] = await Promise.all([
      api.get<{ applications: AppRow[] }>('/api/applications'),
      api.get<{ items: PipelineRow[] }>('/api/pipeline?status=pending'),
    ]);
    setApps(a.applications);
    setPending(p.items);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { pending: pending.length, applied: 0, responded: 0, interview: 0, offer: 0, rejected: 0, discarded: 0 };
    for (const a of apps) {
      if (a.status === 'Applied') c.applied++;
      else if (a.status === 'Responded') c.responded++;
      else if (a.status === 'Interview') c.interview++;
      else if (a.status === 'Offer') c.offer++;
      else if (a.status === 'Rejected') c.rejected++;
      else if (a.status === 'Discarded' || a.status === 'SKIP') c.discarded++;
    }
    return c;
  }, [apps, pending]);

  // Build a unified row list: pending pipeline_urls + applications.
  const allRows = useMemo(() => {
    const fromApps = apps.map((a) => ({ kind: 'app' as const, app: a, pipeline: null as PipelineRow | null }));
    const fromPending = pending.map((p) => ({ kind: 'pending' as const, app: null as AppRow | null, pipeline: p }));
    return [...fromApps, ...fromPending];
  }, [apps, pending]);

  const filterCounts: Record<FilterKey, number> = {
    all: allRows.length,
    pending: pending.length + apps.filter((a) => a.status === 'Evaluated').length,
    applied: counts.applied + counts.responded,
    interview: counts.interview,
    offer: counts.offer,
    closed: counts.rejected + counts.discarded,
    high: apps.filter((a) => a.score && Number(a.score) >= 4.0).length,
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter((r) => {
      const company = r.kind === 'app' ? r.app!.company : r.pipeline!.company ?? '';
      const role = r.kind === 'app' ? r.app!.role : r.pipeline!.title ?? '';
      if (q && !`${company} ${role}`.toLowerCase().includes(q)) return false;

      switch (filter) {
        case 'all': return true;
        case 'pending':
          return r.kind === 'pending' || r.app?.status === 'Evaluated';
        case 'applied':
          return r.kind === 'app' && (r.app!.status === 'Applied' || r.app!.status === 'Responded');
        case 'interview':
          return r.kind === 'app' && r.app!.status === 'Interview';
        case 'offer':
          return r.kind === 'app' && r.app!.status === 'Offer';
        case 'closed':
          return r.kind === 'app' && (r.app!.status === 'Rejected' || r.app!.status === 'Discarded' || r.app!.status === 'SKIP');
        case 'high':
          return r.kind === 'app' && r.app!.score != null && Number(r.app!.score) >= 4.0;
        default:
          return true;
      }
    });
  }, [allRows, filter, search]);

  async function addUrl() {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const r = await api.post<{ item: { id: string } }>('/api/pipeline', { url: newUrl.trim() });
      if (r.item?.id) {
        await api.post('/api/pipeline/evaluate', { ids: [r.item.id] });
        setNewUrl('');
        await load();
        alert('URL agregada y enviada a evaluar. Volverá a aparecer en unos minutos.');
      } else {
        alert('No se pudo agregar (probablemente ya está en el pipeline).');
      }
    } finally {
      setAdding(false);
    }
  }

  async function updateStatus(appId: string, s: ApplicationStatus) {
    await api.patch(`/api/applications/${appId}`, { status: s });
    await load();
  }

  async function discardPending(id: string) {
    await api.delete(`/api/pipeline/${id}`);
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-h1 text-intel-700">🎯 Pipeline</h1>
        <p className="text-text-muted text-sm">
          {counts.pending} pendientes · {apps.length} aplicaciones · scan automático cada 6h
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatsCard label="Pendientes"   icon="📥" value={counts.pending}    accent="#6b7280" active={filter === 'pending'}   onClick={() => setFilter('pending')} />
        <StatsCard label="Aplicadas"    icon="📤" value={counts.applied}    accent="#41aafd" active={filter === 'applied'}   onClick={() => setFilter('applied')} />
        <StatsCard label="Contactadas"  icon="📞" value={counts.responded}  accent="#ffc00d" />
        <StatsCard label="Entrevista"   icon="🎤" value={counts.interview}  accent="#ff910e" active={filter === 'interview'} onClick={() => setFilter('interview')} />
        <StatsCard label="Ofertas"      icon="🎁" value={counts.offer}      accent="#b4d70e" active={filter === 'offer'}     onClick={() => setFilter('offer')} />
        <StatsCard label="Rechazadas"   icon="❌" value={counts.rejected}   accent="#ef4444" active={filter === 'closed'}    onClick={() => setFilter('closed')} />
      </div>

      {/* Add URL */}
      <Card className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
        <input
          type="text"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addUrl(); }}
          placeholder="🔗 Pega URL de oferta (LinkedIn / Computrabajo / PROCOMER / Talent.com / CINDE) …"
          className="flex-1 rounded border border-gris-300 px-3 py-2 text-sm"
        />
        <Button onClick={addUrl} disabled={!newUrl.trim() || adding}>
          {adding ? 'Encolando…' : '+ Agregar y evaluar'}
        </Button>
        <Link href="/scan"><Button variant="secondary">🔍 Run scan</Button></Link>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.key}
            label={f.label(filterCounts[f.key])}
            active={filter === f.key}
            onClick={() => setFilter(f.key)}
          />
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa o rol…"
          className="ml-auto rounded border border-gris-300 px-3 py-1.5 text-sm w-full md:w-[260px]"
        />
      </div>

      {/* Table */}
      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-gris-500">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gris-500">No hay ofertas en este filtro.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-intel-50 text-intel-700 text-left">
              <tr>
                <th className="px-3 py-2 w-12 text-[10px] uppercase tracking-wide font-semibold">#</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold">Empresa & Rol</th>
                <th className="px-3 py-2 w-20 text-[10px] uppercase tracking-wide font-semibold">Score</th>
                <th className="px-3 py-2 w-44 text-[10px] uppercase tracking-wide font-semibold">Estado</th>
                <th className="px-3 py-2 w-[280px] text-[10px] uppercase tracking-wide font-semibold">Línea de tiempo</th>
                <th className="px-3 py-2 w-32 text-[10px] uppercase tracking-wide font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                if (r.kind === 'pending') {
                  const p = r.pipeline!;
                  return (
                    <tr key={`p-${p.id}`} className="border-t border-gris-300/60 hover:bg-intel-50/30 align-top">
                      <td className="px-3 py-3 text-gris-500">—</td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-intel-700">{p.company ?? '—'}</div>
                        <div className="text-xs text-negro/80">{p.title ?? '—'}</div>
                        <div className="text-[10px] uppercase text-gris-500 mt-1">{p.source ?? 'manual'}</div>
                      </td>
                      <td className="px-3 py-3 text-gris-500">—</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide border-l-2 ${STATUS_BADGE.Evaluated.tone}`}>
                          {STATUS_BADGE.Evaluated.icon} Pendiente
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Timeline
                          steps={[
                            { label: 'Aplicada', state: 'pending', meta: 'sin aplicar' },
                            { label: 'Contactada', state: 'pending' },
                            { label: 'Entrevista', state: 'pending' },
                            { label: 'Esperando decisión', state: 'pending' },
                          ]}
                          summary={`📥 Scanned ${new Date(p.scannedAt).toLocaleDateString()}`}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap align-top">
                        <a className="block text-[12px] text-lima font-semibold pb-1 mb-1.5 border-b border-dashed border-gris-300 hover:underline" href={p.url} target="_blank" rel="noreferrer">🔗 Ver oferta</a>
                        <button onClick={() => api.post('/api/pipeline/evaluate', { ids: [p.id] }).then(load)} className="block text-[12px] text-core-700 hover:underline">📄 Evaluar</button>
                        <button onClick={() => discardPending(p.id)} className="block text-[12px] text-red-600 hover:underline">❌ Descartar</button>
                      </td>
                    </tr>
                  );
                }

                const a = r.app!;
                const scoreNum = a.score ? Number(a.score) : null;
                const badge = STATUS_BADGE[a.status];
                const tl = buildTimeline({ status: a.status, date: a.date, updatedAt: a.updatedAt, score: scoreNum });
                return (
                  <tr key={`a-${a.id}`} className="border-t border-gris-300/60 hover:bg-intel-50/30 align-top">
                    <td className="px-3 py-3 text-gris-500">{a.num}</td>
                    <td className="px-3 py-3">
                      <Link href={`/applications/${a.id}`} className="font-semibold text-intel-700 hover:underline">
                        {a.company}
                      </Link>
                      <div className="text-xs text-negro/80">{a.role}</div>
                    </td>
                    <td className="px-3 py-3">
                      {scoreNum != null && (
                        <span className={`font-bold text-base ${scoreClass(scoreNum)}`}>{scoreNum.toFixed(1)}/5</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide border-l-2 ${badge.tone}`}>
                        {badge.icon} {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Timeline steps={tl.steps} summary={tl.summary} summaryTone={tl.tone} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap align-top">
                      {a.url && (
                        <a className="block text-[12px] text-lima font-semibold pb-1 mb-1.5 border-b border-dashed border-gris-300 hover:underline" href={a.url} target="_blank" rel="noreferrer">🔗 Ver oferta</a>
                      )}
                      <Link href={`/applications/${a.id}`} className="block text-[12px] text-core-700 hover:underline">📄 Reporte</Link>
                      {a.status === 'Interview' && <a href="#" className="block text-[12px] text-naranja hover:underline">🎯 Prep</a>}
                      {a.status === 'Offer' && <a href="#" className="block text-[12px] text-lima hover:underline">✍️ Negociar</a>}
                      {(a.status === 'Applied' || a.status === 'Responded') && <a href="#" className="block text-[12px] text-amarillo hover:underline">📩 Follow-up</a>}
                      <div className="mt-1 pt-1 border-t border-dashed border-gris-300 flex justify-end">
                        <RowMenu
                          currentStatus={a.status}
                          onChangeStatus={(s) => updateStatus(a.id, s)}
                          onCopyUrl={a.url ? () => navigator.clipboard.writeText(a.url!) : undefined}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
