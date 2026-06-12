'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Kpi {
  key: string;
  label: string;
  value: number;   // 0-100
  target: number;  // 0-100
  ok: boolean;
  detail: string;
}

export function AdminMetrics() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ totalMembers: number; kpis: Kpi[] }>('/api/admin/metrics');
      setKpis(res.kpis);
      setTotal(res.totalMembers);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
          Métricas clave <span className="text-gris-300">·</span> {total} clientes
        </h2>
        <button onClick={load} disabled={loading} className="text-xs text-gris-500 hover:text-intel-700 transition disabled:opacity-50">
          {loading ? 'Cargando…' : 'Recargar'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-[#FDEBEC] rounded-lg text-sm text-[#9F2F2D]">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((k) => {
          const fill = Math.min(100, k.value);
          const barColor = k.ok ? 'bg-[#4Fae54]' : k.value >= k.target * 0.75 ? 'bg-amarillo' : 'bg-[#E0625F]';
          return (
            <div key={k.key} className="bg-white border border-hairline rounded-3xl p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-sm font-medium text-intel-700 leading-tight">{k.label}</span>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  k.ok ? 'bg-[#EDF3EC] text-[#346538]' : 'bg-[#FBF3DB] text-[#7a5d00]'
                }`}>
                  {k.ok ? 'En objetivo' : 'Bajo objetivo'}
                </span>
              </div>

              <div className="flex items-end gap-2 mb-3">
                <span className="text-4xl font-bold text-intel-700 tabular-nums leading-none">
                  {loading ? '—' : `${k.value}%`}
                </span>
                <span className="text-xs text-gris-500 mb-1">objetivo &gt; {k.target}%</span>
              </div>

              {/* Barra con marcador de objetivo */}
              <div className="relative h-2 rounded-full bg-gris-100 overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${fill}%` }} />
              </div>
              <div className="relative h-3">
                <div className="absolute top-0 w-px h-2 bg-intel-700/50" style={{ left: `${k.target}%` }} title={`objetivo ${k.target}%`} />
              </div>

              <div className="text-xs text-gris-500 mt-1">{k.detail}</div>
            </div>
          );
        })}
        {kpis.length === 0 && !loading && (
          <div className="col-span-full px-6 py-12 text-center text-gris-500 text-sm">Sin datos de métricas todavía.</div>
        )}
      </div>
    </section>
  );
}
