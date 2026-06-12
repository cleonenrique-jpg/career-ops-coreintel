'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Funnel {
  pending: number;
  applications: Record<string, number>;
  cost_usd: number;
}

interface RibbonData {
  pending: number;
  applied: number;
  interview: number;
  offer: number;
  cost: string;
  lastScan: string | null;
}

function formatCost(usd: number | undefined): string {
  if (!usd || usd === 0) return '$0.00';
  if (usd < 0.01) return `${(usd * 100).toFixed(2)}¢`;
  return `$${usd.toFixed(2)}`;
}

export function Ribbon() {
  const [d, setD] = useState<RibbonData | null>(null);

  useEffect(() => {
    api.get<Funnel>('/api/metrics/funnel').then((f) => {
      setD({
        pending: f.pending,
        applied: (f.applications.Applied ?? 0) + (f.applications.Responded ?? 0),
        interview: f.applications.Interview ?? 0,
        offer: f.applications.Offer ?? 0,
        cost: formatCost(f.cost_usd),
        lastScan: null, // TODO wire from /api/metrics/scans
      });
    });
  }, []);

  if (!d) return null;

  return (
    <div className="bg-tile rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
      <span className="text-gris-500">
        <span className="font-bold text-core-700 text-base">{d.pending}</span> pendientes
      </span>
      <span className="text-gris-300">·</span>
      <span className="text-gris-500">
        <span className="font-bold text-intel-700">{d.applied}</span> aplicadas
      </span>
      <span className="text-gris-300">·</span>
      <span className="text-gris-500">
        <span className="font-bold text-estado-warn">{d.interview}</span> entrev
      </span>
      <span className="text-gris-300">·</span>
      <span className="text-gris-500">
        <span className="font-bold text-[#5b6c00]">{d.offer}</span> oferta
      </span>
      <span className="text-gris-300 ml-auto hidden md:inline">·</span>
      <span className="text-gris-500 text-xs">
        💰 <span className="font-semibold text-intel-700">{d.cost}</span> USD acum.
      </span>
      <span className="text-gris-300 hidden md:inline">·</span>
      <span className="text-gris-500 text-xs">
        🔄 scan cada 6h
      </span>
    </div>
  );
}
