'use client';

import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Portal {
  id: string;
  source: string;
  companyName: string | null;
  careersUrl: string | null;
  apiUrl: string | null;
  enabled: boolean;
}

interface Funnel {
  pending: number;
  applications: Record<string, number>;
  cost_usd: number;
}

const TABS = [
  { key: 'fuentes', label: 'Fuentes' },
  { key: 'scans',   label: 'Scans' },
  { key: 'costos',  label: 'Costos' },
  { key: 'storage', label: 'Storage' },
] as const;
type TabKey = typeof TABS[number]['key'];

function SistemaContent() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TabKey>('fuentes');

  async function load() {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      api.get<{ portals: any[] }>('/api/scan/portals'),
      api.get<Funnel>('/api/metrics/funnel'),
    ]);
    setPortals(r1.portals.map((p) => ({
      id: p.id, source: p.source, companyName: p.companyName,
      careersUrl: p.careersUrl, apiUrl: p.apiUrl, enabled: p.enabled,
    })));
    setFunnel(r2);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function runScan() {
    setRunning(true);
    try {
      const r = await api.post<{ accepted: boolean; note?: string }>('/api/scan/run', {});
      alert(r.note ?? 'Scan disparado.');
    } finally { setRunning(false); }
  }
  async function removePortal(id: string) {
    if (!confirm('¿Eliminar portal?')) return;
    await api.delete(`/api/scan/portals/${id}`);
    load();
  }

  const sourceBreakdown = portals.reduce<Record<string, number>>((acc, p) => {
    acc[p.source] = (acc[p.source] ?? 0) + 1; return acc;
  }, {});

  return (
    <div className="editorial-font min-h-screen bg-[#FBFBFA] -mx-6 -my-8 px-6 py-12 md:px-12 md:py-16">
      <div className="max-w-6xl mx-auto space-y-16">

        <header className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
            Coreintel · Career Ops
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-intel-700 tracking-[-0.02em] leading-[1.05]">
            Sistema
          </h1>
          <p className="text-base text-gris-500 max-w-xl leading-relaxed">
            Fuentes de scan, ejecuciones recientes, costos LLM y storage.
          </p>
        </header>

        {/* Tabs editorial */}
        <nav className="flex gap-8 border-b border-[#EAEAEA]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`pb-3 text-sm font-medium transition relative ${
                active === t.key
                  ? 'text-intel-700'
                  : 'text-gris-500 hover:text-intel-700'
              }`}
            >
              {t.label}
              {active === t.key && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-intel-700" />
              )}
            </button>
          ))}
        </nav>

        {loading && (
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-12 text-center text-gris-500 text-sm">
            Cargando…
          </div>
        )}

        {!loading && active === 'fuentes' && (
          <div className="space-y-8">
            <section className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[#EAEAEA] border border-[#EAEAEA] rounded-xl overflow-hidden">
              <div className="bg-white px-6 py-5 col-span-2 md:col-span-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-gris-500 font-medium mb-1">
                  Total portales
                </div>
                <div className="text-3xl font-bold text-intel-700 tabular-nums">{portals.length}</div>
              </div>
              <div className="bg-white px-6 py-5 col-span-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-gris-500 font-medium mb-2">
                  Breakdown por fuente
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gris-500">
                  {Object.entries(sourceBreakdown).map(([s, n]) => (
                    <span key={s} className="font-mono">
                      <span className="text-intel-700 font-semibold">{n}</span> {s}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
                  Portales configurados <span className="text-gris-300">·</span> {portals.length}
                </h2>
                <button
                  onClick={runScan}
                  disabled={running}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
                >
                  {running ? 'Disparando…' : 'Ejecutar scan ahora'}
                </button>
              </div>

              <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#EAEAEA]">
                      <th className="text-left px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Fuente</th>
                      <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Empresa</th>
                      <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">URL</th>
                      <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Estado</th>
                      <th className="text-right px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portals.map((p, idx) => (
                      <tr key={p.id} className={`${idx !== portals.length - 1 ? 'border-b border-[#F3F3F1]' : ''} hover:bg-[#FBFBFA] transition-colors`}>
                        <td className="px-6 py-4">
                          <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-gris-500">{p.source}</span>
                        </td>
                        <td className="px-3 py-4 text-intel-700 font-medium">{p.companyName ?? '—'}</td>
                        <td className="px-3 py-4 text-xs text-gris-500 font-mono break-all">{p.careersUrl ?? p.apiUrl ?? '—'}</td>
                        <td className="px-3 py-4">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] font-semibold ${
                            p.enabled ? 'bg-[#EDF3EC] text-[#346538]' : 'bg-[#F3F3F1] text-gris-500'
                          }`}>
                            {p.enabled ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => removePortal(p.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded border border-[#EAEAEA] text-intel-700 hover:bg-[#FDEBEC] hover:border-[#FDEBEC] hover:text-[#9F2F2D] active:scale-[0.98] transition"
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {portals.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-gris-500 text-sm">Sin portales.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {!loading && active === 'scans' && (
          <section className="bg-white border border-[#EAEAEA] rounded-xl p-8 space-y-4">
            <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
              Scans automáticos
            </h2>
            <p className="text-sm text-gris-500 leading-relaxed">
              El scanner corre <span className="font-semibold text-intel-700">cada 6 horas</span> por cron en Railway.
              Próximamente: historial detallado por ejecución.
            </p>
            <button
              onClick={runScan}
              disabled={running}
              className="px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
            >
              {running ? 'Disparando…' : 'Ejecutar scan manual'}
            </button>
            <p className="text-xs text-gris-500 pt-2 border-t border-[#F3F3F1]">
              <span className="uppercase tracking-[0.1em] font-medium">Fuentes activas</span>{' '}
              · Greenhouse · Ashby · Lever (APIs) · Talent.com · Computrabajo · PROCOMER · CINDE · LinkedIn (Playwright)
            </p>
          </section>
        )}

        {!loading && active === 'costos' && (
          <section className="space-y-6">
            <div className="bg-white border border-[#EAEAEA] rounded-xl p-8">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gris-500 font-medium mb-2">
                Costo LLM acumulado
              </div>
              <div className="text-5xl font-bold text-intel-700 tracking-[-0.02em]">
                {(() => {
                  const total = funnel?.cost_usd ?? 0;
                  return total < 0.01 ? `${(total * 100).toFixed(2)}¢` : `$${total.toFixed(2)}`;
                })()}
                <span className="text-base text-gris-500 ml-2 font-normal">USD</span>
              </div>
              <p className="text-xs text-gris-500 mt-2">Suma de todas las evaluaciones</p>
            </div>

            <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gris-500 font-medium">
                Modelo activo
              </div>
              <code className="block bg-[#F5F5F7] px-3 py-2 rounded font-mono text-sm text-intel-700">
                gemini-2.0-flash
              </code>
              <p className="text-xs text-gris-500">Free tier — sin billing en Google Cloud.</p>
              <p className="text-xs text-gris-500 pt-2 border-t border-[#F3F3F1]">
                Para subir a <code className="bg-[#F5F5F7] px-1.5 py-0.5 rounded text-[11px]">gemini-2.5-pro</code> habilitá billing.
              </p>
            </div>
          </section>
        )}

        {!loading && active === 'storage' && (
          <section className="bg-white border border-[#EAEAEA] rounded-xl p-8 space-y-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gris-500 font-medium">
              Supabase Storage
            </div>
            <div>
              <div className="text-xs text-gris-500 mb-1">Bucket</div>
              <code className="block bg-[#F5F5F7] px-3 py-2 rounded font-mono text-sm text-intel-700">
                career-ops
              </code>
            </div>
            <div>
              <div className="text-xs text-gris-500 mb-1">Estructura</div>
              <code className="block bg-[#F5F5F7] px-3 py-2 rounded font-mono text-xs text-intel-700">
                {`{user_id}/pdfs/cv-{slug}.pdf`}
              </code>
            </div>
            <p className="text-xs text-gris-500 pt-2 border-t border-[#F3F3F1]">
              Próximamente: tamaño usado y limpieza de PDFs antiguos.
            </p>
          </section>
        )}

      </div>
    </div>
  );
}

export default function SistemaPage() {
  return (
    <Suspense fallback={<p className="text-gris-500">Cargando…</p>}>
      <SistemaContent />
    </Suspense>
  );
}
