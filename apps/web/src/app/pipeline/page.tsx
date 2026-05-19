'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';

interface PipelineItem {
  id: string;
  url: string;
  company: string | null;
  title: string | null;
  status: string;
  scanned_at: string;
}

export default function PipelinePage() {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  async function load() {
    setLoading(true);
    const q = filter === 'pending' ? '?status=pending' : '';
    const res = await api.get<{ items: PipelineItem[] }>(`/api/pipeline${q}`);
    setItems(res.items);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function evaluateSelected() {
    if (selected.size === 0) return;
    await api.post('/api/pipeline/evaluate', { ids: Array.from(selected) });
    setSelected(new Set());
    await load();
    alert(`${selected.size} ofertas en cola — chequeá Applications en unos minutos.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-intel-700">Pipeline</h1>
          <p className="text-text-muted">{items.length} URLs {filter === 'pending' ? 'pendientes' : 'totales'}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'pending' | 'all')}
            className="rounded border border-gris-300 px-2 py-1.5 text-sm"
          >
            <option value="pending">Pendientes</option>
            <option value="all">Todas</option>
          </select>
          <Button onClick={evaluateSelected} disabled={selected.size === 0}>
            Evaluar {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <div className="p-6 text-gris-500">Cargando…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-intel-50 text-intel-700 text-left">
              <tr>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Scanned</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-gris-300/60 hover:bg-intel-50/40">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(it.id)}
                      onChange={() => toggle(it.id)}
                      disabled={it.status !== 'pending'}
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold text-intel-700">{it.company ?? '—'}</td>
                  <td className="px-3 py-2">
                    <a className="text-core-700 hover:underline" href={it.url} target="_blank" rel="noreferrer">{it.title ?? it.url}</a>
                  </td>
                  <td className="px-3 py-2">{it.status}</td>
                  <td className="px-3 py-2 text-gris-500">{new Date(it.scanned_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
