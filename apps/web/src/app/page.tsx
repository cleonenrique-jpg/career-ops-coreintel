'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import Link from 'next/link';
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
  cvTailoredUrl: string | null;
  cvTailoredCoverage: string | null;
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

interface FollowUpItem {
  applicationId: string;
  num: number;
  company: string;
  role: string;
  status: ApplicationStatus;
  score: string | null;
  url: string | null;
  daysSinceMovement: number;
  threshold: number;
  isOverdue: boolean;
  lastFollowUpAt: string | null;
}

type QuickFilter = 'all' | 'active' | 'applied' | 'interview' | 'offer' | 'closed' | 'high';

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

function scoreColor(score: number | null): string {
  if (score == null) return 'text-gris-300';
  if (score >= 4.0) return 'text-[#346538]';
  if (score >= 3.0) return 'text-[#a85100]';
  return 'text-[#9F2F2D]';
}

export default function PipelineHome() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [pending, setPending] = useState<PipelineRow[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [search, setSearch] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [a, p, f] = await Promise.all([
      api.get<{ applications: AppRow[] }>('/api/applications'),
      api.get<{ items: PipelineRow[] }>('/api/pipeline?status=pending'),
      api.get<{ followUps: FollowUpItem[] }>('/api/follow-ups'),
    ]);
    setApps(a.applications);
    setPending(p.items);
    setFollowUps(f.followUps);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<ApplicationStatus, number> = { Applied: 0, Responded: 0, Interview: 0, Offer: 0, Rejected: 0, SKIP: 0, Evaluated: 0, Discarded: 0 };
    for (const a of apps) c[a.status]++;
    return c;
  }, [apps]);

  const activeFollowUpIds = useMemo(() => new Set(followUps.map((f) => f.applicationId)), [followUps]);

  const sortedApps = useMemo(() => {
    return [...apps].sort((a, b) => {
      const sa = a.score ? Number(a.score) : -1;
      const sb = b.score ? Number(b.score) : -1;
      if (sa !== sb) return sb - sa;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [apps]);

  const allRows = useMemo(() => {
    const fromApps = sortedApps.map((a) => ({ kind: 'app' as const, app: a, pipeline: null as PipelineRow | null }));
    const fromPending = pending.map((p) => ({ kind: 'pending' as const, app: null as AppRow | null, pipeline: p }));
    return [...fromApps, ...fromPending];
  }, [sortedApps, pending]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter((r) => {
      const company = r.kind === 'app' ? r.app!.company : r.pipeline!.company ?? '';
      const role = r.kind === 'app' ? r.app!.role : r.pipeline!.title ?? '';
      const notes = r.kind === 'app' ? r.app!.notes ?? '' : '';
      if (q && !`${company} ${role} ${notes}`.toLowerCase().includes(q)) return false;
      switch (filter) {
        case 'all': return true;
        case 'active':    return r.kind === 'pending' || (r.app && ['Evaluated', 'Applied', 'Responded', 'Interview'].includes(r.app.status));
        case 'applied':   return r.kind === 'app' && (r.app!.status === 'Applied' || r.app!.status === 'Responded');
        case 'interview': return r.kind === 'app' && r.app!.status === 'Interview';
        case 'offer':     return r.kind === 'app' && r.app!.status === 'Offer';
        case 'closed':    return r.kind === 'app' && (r.app!.status === 'Rejected' || r.app!.status === 'Discarded' || r.app!.status === 'SKIP');
        case 'high':      return r.kind === 'app' && r.app!.score != null && Number(r.app!.score) >= 4.0;
        default: return true;
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
      } else {
        alert('No se pudo agregar (probablemente ya está en el pipeline).');
      }
    } finally { setAdding(false); }
  }
  async function runScan() {
    const r = await api.post<{ accepted: boolean; note?: string }>('/api/scan/run', {});
    alert(r.note ?? 'Scan solicitado.');
  }
  async function updateStatus(appId: string, s: ApplicationStatus) {
    await api.patch(`/api/applications/${appId}`, { status: s });
    await load();
  }
  async function discardPending(id: string) {
    await api.delete(`/api/pipeline/${id}`);
    await load();
  }
  async function markFollowUpSent(applicationId: string) {
    await api.post(`/api/follow-ups/${applicationId}`, { kind: 'check-in' });
    await load();
  }

  const stats = [
    { key: 'active' as QuickFilter, label: 'Pendientes', value: counts.Evaluated + pending.length },
    { key: 'applied' as QuickFilter, label: 'Aplicadas', value: counts.Applied + counts.Responded },
    { key: 'interview' as QuickFilter, label: 'Entrevistas', value: counts.Interview },
    { key: 'offer' as QuickFilter, label: 'Ofertas', value: counts.Offer },
    { key: 'closed' as QuickFilter, label: 'Cerradas', value: counts.Rejected + counts.SKIP + counts.Discarded },
  ];

  return (
    <div className="editorial-font min-h-screen bg-[#FBFBFA] -mx-6 -my-8 px-6 py-12 md:px-12 md:py-16">
      <div className="max-w-6xl mx-auto space-y-12">

        <header className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
            Coreintel · Career Ops
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-intel-700 tracking-[-0.02em] leading-[1.05]">
            Pipeline
          </h1>
          <p className="text-base text-gris-500 max-w-xl leading-relaxed">
            Ofertas evaluadas, aplicaciones en curso y follow-ups pendientes.
          </p>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-px bg-[#EAEAEA] border border-[#EAEAEA] rounded-xl overflow-hidden">
          {stats.map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
              className={`text-left px-5 py-5 transition-colors ${
                filter === s.key ? 'bg-intel-700 text-white' : 'bg-white hover:bg-[#FBFBFA]'
              }`}
            >
              <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${
                filter === s.key ? 'text-white/70' : 'text-gris-500'
              }`}>
                {s.label}
              </div>
              <div className={`text-3xl font-bold tabular-nums ${
                filter === s.key ? 'text-white' : 'text-intel-700'
              }`}>
                {loading ? '—' : s.value}
              </div>
            </button>
          ))}
        </section>

        {/* Follow-ups alert */}
        {followUps.length > 0 && (
          <section className="bg-[#FBF3DB] border border-[#F4E4B0] rounded-xl p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#7a5d00] font-semibold">
                Follow-ups pendientes <span className="opacity-60">·</span> {followUps.length}
              </h2>
            </div>
            <div className="space-y-2">
              {followUps.map((f) => (
                <div key={f.applicationId} className="flex flex-wrap items-center justify-between gap-2 text-sm py-2 border-t border-[#F4E4B0]/60 first:border-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link href={`/applications/${f.applicationId}`} className="font-medium text-intel-700 hover:underline">{f.company}</Link>
                    <span className="text-gris-500 text-xs">{f.role}</span>
                    <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-[#7a5d00] font-mono">
                      {f.daysSinceMovement}d sin movimiento
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.url && (
                      <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-intel-700 hover:underline">
                        Oferta ↗
                      </a>
                    )}
                    <button
                      onClick={() => markFollowUpSent(f.applicationId)}
                      className="px-3 py-1 text-xs font-medium rounded border border-[#F4E4B0] text-[#7a5d00] hover:bg-white active:scale-[0.98] transition"
                    >
                      Marcar enviado
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* URL input + Scan */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
              Agregar oferta
            </h2>
          </div>
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[280px]">
                <label className="block text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-2">
                  URL de oferta
                </label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addUrl(); }}
                  placeholder="LinkedIn / Computrabajo / PROCOMER / Talent.com / CINDE…"
                  className="w-full border-0 border-b border-[#EAEAEA] bg-transparent px-0 py-2 text-base text-intel-700 placeholder:text-gris-300 focus:outline-none focus:border-intel-700 transition-colors"
                />
              </div>
              <button
                onClick={addUrl}
                disabled={!newUrl.trim() || adding}
                className="px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
              >
                {adding ? 'Encolando…' : 'Agregar'}
              </button>
              <button
                onClick={runScan}
                className="px-5 py-2 text-sm font-medium rounded-md border border-[#EAEAEA] text-intel-700 hover:bg-[#F5F5F7] active:scale-[0.98] transition"
              >
                Scan ahora
              </button>
            </div>
          </div>
        </section>

        {/* Filters + Search */}
        <section className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === 'all' ? 'bg-intel-700 text-white border-intel-700' : 'border-[#EAEAEA] text-gris-500 hover:border-intel-700 hover:text-intel-700'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter(filter === 'high' ? 'all' : 'high')}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === 'high' ? 'bg-[#346538] text-white border-[#346538]' : 'border-[#EAEAEA] text-gris-500 hover:border-[#346538] hover:text-[#346538]'
            }`}
          >
            Score ≥ 4.0
          </button>
          <div className="ml-auto">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa, rol, notas…"
              className="border border-[#EAEAEA] rounded-md bg-white px-3 py-1.5 text-xs text-intel-700 placeholder:text-gris-300 focus:outline-none focus:border-intel-700 w-[240px] transition-colors"
            />
          </div>
        </section>

        {/* Table */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
              Aplicaciones <span className="text-gris-300">·</span> {filtered.length}
            </h2>
          </div>

          <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden">
            {loading ? (
              <div className="px-6 py-12 text-center text-gris-500 text-sm">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-16 text-center text-gris-500 text-sm">Sin resultados para este filtro.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EAEAEA]">
                    <th className="text-left px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium w-12">#</th>
                    <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Empresa & Rol</th>
                    <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium w-20">Score</th>
                    <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium w-32">Estado</th>
                    <th className="text-center px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium w-28">CV adaptado</th>
                    <th className="text-right px-6 py-4 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => {
                    const isLast = idx === filtered.length - 1;
                    if (r.kind === 'pending') {
                      const p = r.pipeline!;
                      return (
                        <tr key={`p-${p.id}`} className={`${!isLast ? 'border-b border-[#F3F3F1]' : ''} hover:bg-[#FBFBFA] transition-colors`}>
                          <td className="px-6 py-4 text-gris-300">—</td>
                          <td className="px-3 py-4">
                            <div className="font-medium text-intel-700 flex items-center gap-2 flex-wrap">
                              {p.company ?? '—'}
                              <span className="text-[10px] uppercase tracking-[0.1em] text-gris-500 font-semibold">{p.source ?? 'manual'}</span>
                            </div>
                            <div className="text-xs text-gris-500 mt-0.5">{p.title ?? '—'}</div>
                          </td>
                          <td className="px-3 py-4 text-gris-300">—</td>
                          <td className="px-3 py-4">
                            <span className="inline-block rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] font-semibold bg-[#F3F3F1] text-gris-500">
                              Pendiente
                            </span>
                          </td>
                          <td className="px-3 py-4 text-center text-gris-300">—</td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="inline-flex gap-1.5">
                              <button
                                onClick={() => api.post('/api/pipeline/evaluate', { ids: [p.id] }).then(load)}
                                className="px-3 py-1 text-[11px] font-medium rounded border border-[#EAEAEA] text-intel-700 hover:bg-[#E1F3FE] hover:border-[#E1F3FE] hover:text-[#1F6C9F] active:scale-[0.98] transition"
                              >
                                Evaluar
                              </button>
                              <button
                                onClick={() => discardPending(p.id)}
                                className="px-3 py-1 text-[11px] font-medium rounded border border-[#EAEAEA] text-gris-500 hover:bg-[#FDEBEC] hover:border-[#FDEBEC] hover:text-[#9F2F2D] active:scale-[0.98] transition"
                              >
                                Descartar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    const a = r.app!;
                    const scoreNum = a.score ? Number(a.score) : null;
                    const pill = STATUS_PILL[a.status];
                    const expanded = expandedId === a.id;
                    const tl = buildTimeline({ status: a.status, date: a.date, updatedAt: a.updatedAt, score: scoreNum });
                    return (
                      <Fragment key={`a-${a.id}`}>
                        <tr className={`${!isLast || expanded ? 'border-b border-[#F3F3F1]' : ''} hover:bg-[#FBFBFA] transition-colors`}>
                          <td className="px-6 py-4 text-gris-500 font-mono text-xs">{a.num}</td>
                          <td className="px-3 py-4">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <Link href={`/applications/${a.id}`} className="font-medium text-intel-700 hover:underline">
                                {a.company}
                              </Link>
                              {activeFollowUpIds.has(a.id) && (
                                <span className="inline-block rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] font-semibold bg-[#FBF3DB] text-[#7a5d00]">
                                  Follow-up
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gris-500 mt-0.5">{a.role}</div>
                          </td>
                          <td className="px-3 py-4">
                            {scoreNum != null ? (
                              <span className={`text-2xl font-bold tabular-nums tracking-[-0.02em] ${scoreColor(scoreNum)}`}>
                                {scoreNum.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-gris-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-4">
                            <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] font-semibold ${pill.bg} ${pill.text}`}>
                              {pill.label}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-center">
                            {a.cvTailoredUrl ? (
                              <a href={a.cvTailoredUrl} target="_blank" rel="noreferrer"
                                 title={`Descargar Word · ${a.cvTailoredCoverage ?? '?'}% cobertura`}
                                 className="inline-block px-2.5 py-1 rounded text-xs font-mono font-semibold bg-[#E1F3FE] text-[#1F6C9F] hover:bg-intel-700 hover:text-white transition">
                                {a.cvTailoredCoverage}%
                              </a>
                            ) : a.status === 'Evaluated' ? (
                              <Link href={`/applications/${a.id}#cv-tailored`}
                                    className="inline-block px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.1em] font-medium border border-dashed border-[#EAEAEA] text-gris-500 hover:border-intel-700 hover:text-intel-700 transition">
                                Generar
                              </Link>
                            ) : (
                              <span className="text-gris-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setExpandedId(expanded ? null : a.id)}
                              className="text-gris-500 hover:text-intel-700 transition w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-[#F5F5F7]"
                              title={expanded ? 'Colapsar' : 'Ver más'}
                            >
                              <span className="text-base leading-none">{expanded ? '−' : '+'}</span>
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className={`bg-[#FBFBFA] ${!isLast ? 'border-b border-[#F3F3F1]' : ''}`}>
                            <td colSpan={6} className="px-6 py-6">
                              <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                  <div className="text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-3">
                                    Línea de tiempo
                                  </div>
                                  <Timeline steps={tl.steps} summary={tl.summary} summaryTone={tl.tone} />
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-3">
                                    Notas de evaluación
                                  </div>
                                  <p className="text-sm text-intel-700 leading-relaxed">{a.notes ?? '—'}</p>
                                  <div className="mt-4 flex flex-wrap gap-3 items-center">
                                    {a.url && (
                                      <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-intel-700 hover:underline">
                                        Ver oferta ↗
                                      </a>
                                    )}
                                    <Link href={`/applications/${a.id}`} className="text-xs text-intel-700 hover:underline">
                                      Reporte completo →
                                    </Link>
                                    {a.status === 'Interview' && (
                                      <Link href={`/applications/${a.id}#prep`} className="text-xs text-[#a85100] hover:underline">
                                        Playbook →
                                      </Link>
                                    )}
                                    <div className="ml-auto">
                                      <RowMenu
                                        currentStatus={a.status}
                                        onChangeStatus={(s) => updateStatus(a.id, s)}
                                        onCopyUrl={a.url ? () => navigator.clipboard.writeText(a.url!) : undefined}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
