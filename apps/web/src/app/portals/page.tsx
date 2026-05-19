'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';

interface Portal {
  id: string;
  source: string;
  company_name: string | null;
  careers_url: string | null;
  api_url: string | null;
  enabled: boolean;
}

export default function PortalsPage() {
  const [rows, setRows] = useState<Portal[]>([]);

  async function load() {
    const r = await api.get<{ portals: any[] }>('/api/scan/portals');
    setRows(r.portals.map((p: any) => ({
      id: p.id,
      source: p.source,
      company_name: p.companyName,
      careers_url: p.careersUrl,
      api_url: p.apiUrl,
      enabled: p.enabled,
    })));
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    await api.delete(`/api/scan/portals/${id}`);
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-h1 text-intel-700">Portals</h1>
      <p className="text-text-muted">{rows.length} portales configurados.</p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-intel-50 text-intel-700 text-left">
            <tr>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Careers URL</th>
              <th className="px-3 py-2">Enabled</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gris-300/60">
                <td className="px-3 py-2">{r.source}</td>
                <td className="px-3 py-2 font-semibold text-intel-700">{r.company_name ?? '—'}</td>
                <td className="px-3 py-2 text-gris-500 break-all">{r.careers_url ?? r.api_url ?? '—'}</td>
                <td className="px-3 py-2">{r.enabled ? '✓' : '—'}</td>
                <td className="px-3 py-2">
                  <Button variant="ghost" onClick={() => remove(r.id)}>Quitar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
