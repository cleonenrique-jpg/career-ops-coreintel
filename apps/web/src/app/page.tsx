'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Timeline, buildTimeline } from '@/components/Timeline';
import { RowMenu } from '@/components/RowMenu';
import { api } from '@/lib/api';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@career-ops/shared';

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

const STATUS_BADGE: Record<ApplicationStatus, { tone: string; icon: string; label: string }> = {
  Evaluated: { tone: 'bg-gris-100 text-gris-700',                  icon: 'inbox',     label: 'Pendiente' },
  Applied:   { tone: 'bg-core/10 text-core-700',                   icon: 'send',      label: 'Aplicada' },
  Responded: { tone: 'bg-amarillo/15 text-[#7a5d00]',              icon: 'forum',     label: 'Contactada' },
  Interview: { tone: 'bg-naranja/15 text-[#a85100]',               icon: 'mic',       label: 'Entrevista' },
  Offer:     { tone: 'bg-lima/20 text-[#5b6c00]',                  icon: 'redeem',    label: '¡Oferta!' },
  Rejected:  { tone: 'bg-red-100 text-red-700',                    icon: 'block',     label: 'Rechazada' },
  Discarded: { tone: 'bg-gris-100 text-gris-500',                  icon: 'archive',   label: 'Descartada' },
  SKIP:      { tone: 'bg-gris-100 text-gris-500',                  icon: 'do_not_disturb_on', label: 'SKIP' },
};

function scoreColor(score: number | null): string {
  if (score == null) return 'text-gris-400';
  if (score >= 4.0) return 'text-[#5b6c00]';
  if (score >= 3.0) return 'text-naranja';
  return 'text-red-600';
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

  // Sort apps by score DESC (default), then by date DESC
  const sortedApps = useMemo(() => {
    return [...apps].sort((a, b) => {
      const sa = a.score ? Number(a.score) : -1;
      const sb = b.score ? Number(b.score) : -1;
      if (sa !== sb) return sb - sa;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [apps]);

  // Combine apps + pending pipeline rows
  const allRows = useMemo(() => {
    const fromApps = sortedApps.map((a) => ({ kind: 'app' as const, app: a, pipeline: null as PipelineRow | null }));
    const fromPending = pending.map((p) => ({ kind: 'pending' as const, app: null as AppRow | null, pipeline: p }));
    return [...fromApps, ...fromPending];
  }, [sortedApps, pending]);

  // Filtering — search now includes notes too
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
        alert('URL agregada y enviada a evaluar.');
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

  const topMatch = useMemo(() => sortedApps.find((a) => a.score && Number(a.score) >= 4.0), [sortedApps]);

  return (
    <div className="space-y-4">
      {followUps.length > 0 && (
        <Card className="border-l-4 border-l-amarillo bg-amarillo/5 py-3 px-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="schedule" size={16} className="text-amarillo" />
            <h3 className="font-semibold text-intel-700 text-sm">Follow-ups pendientes ({followUps.length})</h3>
          </div>
          <div className="space-y-1.5">
            {followUps.map((f) => (
              <div key={f.applicationId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-3">
                  <Link href={`/applications/${f.applicationId}`} className="font-semibold text-intel-700 hover:underline">{f.company}</Link>
                  <span className="text-gris-500 text-xs">{f.role}</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-naranja/15 text-[#a85100] font-semibold">
                    {f.status} · {f.daysSinceMovement}d sin movimiento
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-core-700 hover:underline flex items-center gap-1">
                      <Icon name="open_in_new" size={12} /> Oferta
                    </a>
                  )}
                  <Button variant="ghost" onClick={() => markFollowUpSent(f.applicationId)} className="text-xs">
                    <Icon name="mark_email_read" size={13} className="mr-1" /> Marcar enviado
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="py-2.5 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[260px] flex items-center gap-1.5 rounded border border-gris-300 px-2.5">
            <Icon name="link" size={14} className="text-gris-500" />
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addUrl(); }}
              placeholder="Pegar URL de oferta (LinkedIn / Computrabajo / PROCOMER / Talent.com / CINDE)…"
              className="flex-1 py-1.5 text-sm outline-none"
            />
          </div>
          <Button onClick={addUrl} disabled={!newUrl.trim() || adding} className="text-sm gap-1.5">
            <Icon name={adding ? 'hourglass_top' : 'add'} size={14} />
            {adding ? 'Encolando…' : 'Agregar'}
          </Button>
          <Button variant="secondary" onClick={runScan} className="text-sm gap-1.5">
            <Icon name="search" size={14} /> Scan
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(counts.Evaluated + pending.length) > 0 && (
          <StatChip label="Pendientes" value={counts.Evaluated + pending.length} icon="inbox" accent="text-gris-700" onClick={() => setFilter(filter === 'active' ? 'all' : 'active')} active={filter === 'active'} />
        )}
        {counts.Applied + counts.Responded > 0 && (
          <StatChip label="Aplicadas" value={counts.Applied + counts.Responded} icon="send" accent="text-core-700" onClick={() => setFilter(filter === 'applied' ? 'all' : 'applied')} active={filter === 'applied'} />
        )}
        {counts.Interview > 0 && (
          <StatChip label="Entrevista" value={counts.Interview} icon="mic" accent="text-naranja" onClick={() => setFilter(filter === 'interview' ? 'all' : 'interview')} active={filter === 'interview'} />
        )}
        {counts.Offer > 0 && (
          <StatChip label="Ofertas" value={counts.Offer} icon="redeem" accent="text-[#5b6c00]" onClick={() => setFilter(filter === 'offer' ? 'all' : 'offer')} active={filter === 'offer'} />
        )}
        {(counts.Rejected + counts.SKIP + counts.Discarded) > 0 && (
          <StatChip label="Cerradas" value={counts.Rejected + counts.SKIP + counts.Discarded} icon="block" accent="text-red-600" onClick={() => setFilter(filter === 'closed' ? 'all' : 'closed')} active={filter === 'closed'} />
        )}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setFilter('all')} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter === 'all' ? 'bg-intel-700 text-white border-intel-700' : 'border-gris-300 text-gris-500 hover:border-intel-700'}`}>
            Todas
          </button>
          <button onClick={() => setFilter(filter === 'high' ? 'all' : 'high')} className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${filter === 'high' ? 'bg-[#5b6c00] text-white border-[#5b6c00]' : 'border-gris-300 text-gris-500 hover:border-[#5b6c00]'}`}>
            <Icon name="star" size={11} /> Score ≥ 4.0
          </button>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa, rol, notas…"
            className="rounded border border-gris-300 px-2.5 py-1 text-xs w-[220px]"
          />
        </div>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-gris-500 text-sm">Cargando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} topMatch={topMatch ?? null} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-intel-50 text-intel-700 text-left">
              <tr>
                <th className="px-3 py-2 w-10 text-[10px] uppercase tracking-wide font-semibold">#</th>
                <th className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold">Empresa & Rol</th>
                <th className="px-3 py-2 w-32 text-[10px] uppercase tracking-wide font-semibold">Estado</th>
                <th className="px-3 py-2 w-24 text-[10px] uppercase tracking-wide font-semibold text-center">CV adaptado</th>
                <th className="px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                if (r.kind === 'pending') {
                  const p = r.pipeline!;
                  return (
                    <tr key={`p-${p.id}`} className="border-t border-gris-300/60 hover:bg-intel-50/30 align-middle">
                      <td className="px-3 py-2.5 text-gris-500">—</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-intel-700">{p.company ?? '—'}</span>
                          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gris-100 text-gris-500 font-semibold">
                            {p.source ?? 'manual'}
                          </span>
                        </div>
                        <div className="text-xs text-negro/70">{p.title ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE.Evaluated.tone}`}>
                          <Icon name={STATUS_BADGE.Evaluated.icon} size={12} /> Pendiente
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-gris-300">—</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => api.post('/api/pipeline/evaluate', { ids: [p.id] }).then(load)} className="text-[11px] text-core-700 hover:underline mr-2">Evaluar</button>
                        <button onClick={() => discardPending(p.id)} className="text-[11px] text-red-600 hover:underline">Descartar</button>
                      </td>
                    </tr>
                  );
                }
                const a = r.app!;
                const scoreNum = a.score ? Number(a.score) : null;
                const badge = STATUS_BADGE[a.status];
                const expanded = expandedId === a.id;
                const tl = buildTimeline({ status: a.status, date: a.date, updatedAt: a.updatedAt, score: scoreNum });
                return (
                  <Fragment key={`a-${a.id}`}>
                    <tr className="border-t border-gris-300/60 hover:bg-intel-50/30 align-middle">
                      <td className="px-3 py-2.5 text-gris-500">{a.num}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <Link href={`/applications/${a.id}`} className="font-semibold text-intel-700 hover:underline">
                            {a.company}
                          </Link>
                          {scoreNum != null && (
                            <span className={`font-bold text-base ${scoreColor(scoreNum)}`}>{scoreNum.toFixed(1)}</span>
                          )}
                          {activeFollowUpIds.has(a.id) && (
                            <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-amarillo/20 text-[#7a5d00] font-bold">
                              Follow-up
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-negro/70">{a.role}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide ${badge.tone}`}>
                          <Icon name={badge.icon} size={12} /> {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {a.cvTailoredUrl ? (
                          <a href={a.cvTailoredUrl} target="_blank" rel="noreferrer" title={`Descargar Word · ${a.cvTailoredCoverage ?? '?'}% cobertura`}
                             className="inline-flex items-center gap-1 px-2 py-1 rounded bg-intel-50 hover:bg-intel-700 hover:text-white text-intel-700 text-xs font-semibold transition-colors">
                            <Icon name="article" size={13} /> {a.cvTailoredCoverage}%
                          </a>
                        ) : a.status === 'Evaluated' ? (
                          <Link href={`/applications/${a.id}#cv-tailored`} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-dashed border-gris-300 text-gris-500 hover:border-intel-700 hover:text-intel-700 text-xs">
                            <Icon name="auto_awesome" size={12} /> Generar
                          </Link>
                        ) : (
                          <span className="text-gris-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => setExpandedId(expanded ? null : a.id)}
                          className="text-gris-500 hover:text-intel-700 p-1"
                          title={expanded ? 'Colapsar' : 'Ver línea de tiempo'}
                        >
                          <Icon name={expanded ? 'expand_less' : 'expand_more'} size={20} />
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-intel-50/30 border-t border-gris-300/40">
                        <td colSpan={5} className="px-6 py-3">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-[10px] uppercase text-gris-500 font-semibold mb-1">Línea de tiempo</div>
                              <Timeline steps={tl.steps} summary={tl.summary} summaryTone={tl.tone} />
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-gris-500 font-semibold mb-1">Notas eval</div>
                              <p className="text-xs text-negro/80 leading-relaxed">{a.notes ?? '—'}</p>
                              <div className="mt-2 flex flex-wrap gap-2 items-center">
                                {a.url && (
                                  <a href={a.url} target="_blank" rel="noreferrer" className="text-[11px] text-core-700 hover:underline flex items-center gap-1">
                                    <Icon name="open_in_new" size={11} /> Ver oferta
                                  </a>
                                )}
                                <Link href={`/applications/${a.id}`} className="text-[11px] text-intel-700 hover:underline flex items-center gap-1">
                                  <Icon name="description" size={11} /> Reporte
                                </Link>
                                {a.status === 'Interview' && (
                                  <Link href={`/applications/${a.id}#prep`} className="text-[11px] text-naranja hover:underline flex items-center gap-1">
                                    <Icon name="psychology" size={11} /> Playbook
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
      </Card>
    </div>
  );
}

function StatChip({ label, value, icon, accent, onClick, active }: { label: string; value: number; icon: string; accent: string; onClick?: () => void; active?: boolean }) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs transition-colors';
  const tone = active ? 'bg-intel-700 text-white border-intel-700' : `bg-white border-gris-300 ${accent} hover:border-intel-700`;
  return (
    <button onClick={onClick} disabled={!onClick} className={`${base} ${tone} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
      <Icon name={icon} size={13} />
      <span className="font-bold">{value}</span>
      <span className={active ? 'opacity-90' : 'opacity-70'}>{label}</span>
    </button>
  );
}

function EmptyState({ filter, topMatch }: { filter: QuickFilter; topMatch: AppRow | null }) {
  if (filter === 'interview') {
    return (
      <div className="p-8 text-center">
        <Icon name="mic" size={28} className="text-naranja mb-2" />
        <p className="text-gris-500 text-sm">Cuando una entrevista esté confirmada, va a aparecer acá.</p>
        {topMatch && (
          <p className="mt-2 text-xs text-gris-500">
            Top match disponible: <Link href={`/applications/${topMatch.id}`} className="text-intel-700 font-semibold hover:underline">{topMatch.company}</Link> ({topMatch.score}/5)
          </p>
        )}
      </div>
    );
  }
  if (filter === 'high') {
    return <div className="p-8 text-center text-gris-500 text-sm">Sin apps con score ≥ 4.0 todavía.</div>;
  }
  if (filter === 'offer') {
    return <div className="p-8 text-center text-gris-500 text-sm">Sin ofertas todavía. Sigue aplicando 💪</div>;
  }
  return (
    <div className="p-8 text-center text-gris-500 text-sm">
      <p>No hay ofertas en este filtro.</p>
      {topMatch && (
        <p className="mt-2 text-xs">
          Tu top match es <Link href={`/applications/${topMatch.id}`} className="text-intel-700 font-semibold hover:underline">{topMatch.company}</Link> ({topMatch.score}/5).
        </p>
      )}
    </div>
  );
}
