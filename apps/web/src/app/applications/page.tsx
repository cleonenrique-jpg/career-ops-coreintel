'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import type { ApplicationStatus } from '@career-ops/shared';

interface AppRow {
  id: string;
  num: number;
  date: string;
  company: string;
  role: string;
  score: string | null;
  status: ApplicationStatus;
  pdfUrl: string | null;
}

export default function ApplicationsPage() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ applications: AppRow[] }>('/api/applications')
      .then((r) => setRows(r.applications))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h1 text-intel-700">Applications</h1>
        <p className="text-text-muted">{rows.length} aplicaciones registradas.</p>
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <div className="p-6 text-gris-500">Cargando…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-intel-50 text-intel-700 text-left">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gris-300/60 hover:bg-intel-50/40">
                  <td className="px-3 py-2 text-gris-500">{r.num}</td>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2 font-semibold text-intel-700">
                    <Link href={`/applications/${r.id}`} className="hover:underline">{r.company}</Link>
                  </td>
                  <td className="px-3 py-2">{r.role}</td>
                  <td className="px-3 py-2">{r.score ?? '—'}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2">
                    {r.pdfUrl
                      ? <a className="text-core-700 hover:underline" href={r.pdfUrl} target="_blank" rel="noreferrer">PDF</a>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
