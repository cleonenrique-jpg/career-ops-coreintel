import { Card } from '@/components/Card';
import { headers } from 'next/headers';

interface FunnelResponse {
  pending: number;
  applications: Record<string, number>;
  cost_usd: number;
}

async function getFunnel(): Promise<FunnelResponse | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${base}/api/metrics/funnel`, {
      cache: 'no-store',
      headers: { Authorization: headers().get('authorization') ?? '' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export default async function Dashboard() {
  const funnel = await getFunnel();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-intel-700">Dashboard</h1>
        <p className="text-text-muted">Vista general de tu pipeline de búsqueda.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-gris-500">Pendientes</div>
          <div className="text-h2 text-core-700 font-bold">{funnel?.pending ?? '—'}</div>
        </Card>
        <Card>
          <div className="text-sm text-gris-500">Evaluadas</div>
          <div className="text-h2 text-intel-700 font-bold">{funnel?.applications?.Evaluated ?? 0}</div>
        </Card>
        <Card>
          <div className="text-sm text-gris-500">Aplicadas</div>
          <div className="text-h2 text-core font-bold">{funnel?.applications?.Applied ?? 0}</div>
        </Card>
        <Card>
          <div className="text-sm text-gris-500">Entrevistas</div>
          <div className="text-h2 text-[#5b6c00] font-bold">{funnel?.applications?.Interview ?? 0}</div>
        </Card>
      </div>

      <Card>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gris-500">Costo LLM acumulado</div>
            <div className="text-h3 text-intel-700">
              ${funnel?.cost_usd?.toFixed(2) ?? '0.00'} USD
            </div>
          </div>
          <a href="/pipeline" className="text-core-700 font-semibold hover:underline">Procesar pipeline →</a>
        </div>
      </Card>
    </div>
  );
}
