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

function formatCost(usd: number | undefined): string {
  if (!usd || usd === 0) return '$0.00 USD';
  if (usd < 0.01) return `${(usd * 100).toFixed(2)}¢ USD`;
  return `$${usd.toFixed(2)} USD`;
}

export default async function Dashboard() {
  const funnel = await getFunnel();
  const apps = funnel?.applications ?? {};
  const total = Object.values(apps).reduce((sum, n) => sum + n, 0);

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
          <div className="text-xs text-gris-500 mt-1">URLs por evaluar</div>
        </Card>
        <Card>
          <div className="text-sm text-gris-500">Evaluadas</div>
          <div className="text-h2 text-intel-700 font-bold">{apps.Evaluated ?? 0}</div>
          <div className="text-xs text-gris-500 mt-1">pendiente decisión</div>
        </Card>
        <Card>
          <div className="text-sm text-gris-500">Aplicadas</div>
          <div className="text-h2 text-core font-bold">{apps.Applied ?? 0}</div>
          <div className="text-xs text-gris-500 mt-1">enviadas</div>
        </Card>
        <Card>
          <div className="text-sm text-gris-500">Entrevistas</div>
          <div className="text-h2 text-[#5b6c00] font-bold">{apps.Interview ?? 0}</div>
          <div className="text-xs text-gris-500 mt-1">en proceso</div>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="text-sm text-gris-500">Total apps registradas</div>
          <div className="text-h3 text-intel-700 font-bold">{total}</div>
          <div className="text-xs text-gris-500 mt-1">
            {[apps.Offer ?? 0, apps.Rejected ?? 0, apps.Discarded ?? 0, apps.SKIP ?? 0]
              .reduce((s, n) => s + n, 0)} cerradas
          </div>
        </Card>
        <Card>
          <div className="text-sm text-gris-500">Costo LLM acumulado</div>
          <div className="text-h3 text-intel-700 font-bold">{formatCost(funnel?.cost_usd)}</div>
          <div className="text-xs text-gris-500 mt-1">incluye fallidos</div>
        </Card>
        <Card>
          <div className="flex justify-between items-center h-full">
            <div>
              <div className="text-sm text-gris-500">Próxima acción</div>
              <div className="text-h4 text-intel-700 font-semibold">Procesar pipeline</div>
            </div>
            <a href="/pipeline" className="text-core-700 font-semibold hover:underline whitespace-nowrap">→</a>
          </div>
        </Card>
      </div>
    </div>
  );
}
