'use client';

import { Suspense, useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Tabs } from '@/components/Tabs';
import { Icon } from '@/components/Icon';
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
  { key: 'fuentes',  label: 'Fuentes',  icon: 'rss_feed' },
  { key: 'scans',    label: 'Scans',    icon: 'autorenew' },
  { key: 'costos',   label: 'Costos',   icon: 'payments' },
  { key: 'storage',  label: 'Storage',  icon: 'folder' },
];

function SistemaContent() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-4">
      <div>
        <h1 className="text-h1 text-intel-700">Sistema</h1>
        <p className="text-text-muted text-sm">Fuentes de scan, ejecuciones recientes, costos LLM y storage.</p>
      </div>

      <Tabs tabs={TABS} defaultTab="fuentes">
        {(active) => {
          if (loading) return <Card><p className="text-gris-500 p-4">Cargando…</p></Card>;

          if (active === 'fuentes') {
            return (
              <div className="space-y-3">
                <Card className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-sm text-gris-500">Total portales configurados</div>
                    <div className="text-h3 text-intel-700 font-bold">{portals.length}</div>
                    <div className="text-xs text-gris-500 mt-1">
                      {Object.entries(sourceBreakdown).map(([s, n]) => `${s}: ${n}`).join(' · ')}
                    </div>
                  </div>
                  <Button onClick={runScan} disabled={running} className="gap-1.5">
                    <Icon name={running ? 'hourglass_top' : 'search'} size={16} />
                    {running ? 'Disparando…' : 'Ejecutar scan ahora'}
                  </Button>
                </Card>

                <Card className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-intel-50 text-intel-700 text-left">
                      <tr>
                        <th className="px-3 py-2">Fuente</th>
                        <th className="px-3 py-2">Empresa</th>
                        <th className="px-3 py-2">URL</th>
                        <th className="px-3 py-2">Activo</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {portals.map((p) => (
                        <tr key={p.id} className="border-t border-gris-300/60">
                          <td className="px-3 py-2 text-xs uppercase text-gris-500">{p.source}</td>
                          <td className="px-3 py-2 font-semibold text-intel-700">{p.companyName ?? '—'}</td>
                          <td className="px-3 py-2 text-gris-500 break-all text-xs">{p.careersUrl ?? p.apiUrl ?? '—'}</td>
                          <td className="px-3 py-2">{p.enabled ? '✓' : '—'}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => removePortal(p.id)} className="text-red-600 hover:underline text-xs">Quitar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            );
          }

          if (active === 'scans') {
            return (
              <Card>
                <p className="text-sm text-gris-500 mb-2">
                  El scanner corre cada 6h por cron en Railway. Próximamente: historial detallado por ejecución.
                </p>
                <Button onClick={runScan} disabled={running} className="gap-1.5">
                  <Icon name="autorenew" size={16} />
                  {running ? 'Disparando…' : 'Ejecutar scan manual'}
                </Button>
                <p className="text-xs text-gris-500 mt-3">
                  Fuentes activas: Greenhouse / Ashby / Lever (APIs) + Talent.com / Computrabajo / PROCOMER / CINDE / LinkedIn (Playwright).
                </p>
              </Card>
            );
          }

          if (active === 'costos') {
            const total = funnel?.cost_usd ?? 0;
            return (
              <div className="space-y-3">
                <Card>
                  <div className="text-sm text-gris-500">Costo LLM acumulado (todas las evaluaciones)</div>
                  <div className="text-h2 text-intel-700 font-bold">
                    {total < 0.01 ? `${(total * 100).toFixed(2)}¢` : `$${total.toFixed(2)}`} USD
                  </div>
                </Card>
                <Card>
                  <p className="text-sm text-gris-500">
                    Modelo activo: <code className="bg-gris-100 px-1.5 py-0.5 rounded">gemini-2.0-flash</code> (free tier).
                  </p>
                  <p className="text-xs text-gris-500 mt-2">
                    Para subir a <code className="bg-gris-100 px-1 rounded">gemini-2.5-pro</code> habilitá billing en Google Cloud.
                  </p>
                </Card>
              </div>
            );
          }

          if (active === 'storage') {
            return (
              <Card>
                <p className="text-sm text-gris-500">
                  Bucket: <code className="bg-gris-100 px-1.5 py-0.5 rounded">career-ops</code> en Supabase Storage.
                </p>
                <p className="text-xs text-gris-500 mt-2">
                  Estructura: <code className="bg-gris-100 px-1 rounded">{`{user_id}/pdfs/cv-{slug}.pdf`}</code>
                </p>
                <p className="text-xs text-gris-500 mt-3">
                  Próximamente: tamaño usado y limpieza de PDFs antiguos.
                </p>
              </Card>
            );
          }

          return null;
        }}
      </Tabs>
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
