'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';

interface PipelineItem {
  id: string;
  url: string;
  company: string | null;
  title: string | null;
  status: string;
  source: string | null;
  scannedAt: string;
}

const PAGE_SIZE = 50;

export default function PipelinePage() {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  async function load() {
    setLoading(true);
    const q = filter === 'pending' ? '?status=pending' : '';
    const res = await api.get<{ items: PipelineItem[] }>(`/api/pipeline${q}`);
    setItems(res.items);
    setLoading(false);
    setPage(0);
  }

  useEffect(() => { load(); }, [filter]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.source) set.add(i.source);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((it) => {
      if (sourceFilter !== 'all' && it.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        (it.company ?? '').toLowerCase().includes(q) ||
        (it.title ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, search, sourceFilter]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function toggleAllPage() {
    const next = new Set(selected);
    const allOnPage = paged.every((it) => next.has(it.id));
    for (const it of paged) {
      if (it.status === 'pending') {
        allOnPage ? next.delete(it.id) : next.add(it.id);
      }
    }
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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-h1 text-intel-700">Pipeline</h1>
          <p className="text-text-muted">
            {filtered.length} de {items.length} URLs · {selected.size} seleccionadas
          </p>
        </div>
        <Button onClick={evaluateSelected} disabled={selected.size === 0}>
          Evaluar {selected.size > 0 ? `(${selected.size})` : ''}
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar empresa o título…"
            className="flex-1 min-w-[200px] rounded border border-gris-300 px-3 py-1.5 text-sm"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'pending' | 'all')}
            className="rounded border border-gris-300 px-2 py-1.5 text-sm"
          >
            <option value="pending">Pendientes</option>
            <option value="all">Todas</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}
            className="rounded border border-gris-300 px-2 py-1.5 text-sm"
          >
            <option value="all">Todas las fuentes</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <div className="p-6 text-gris-500">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-gris-500">Sin resultados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-intel-50 text-intel-700 text-left">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    onChange={toggleAllPage}
                    checked={paged.length > 0 && paged.every((it) => selected.has(it.id))}
                  />
                </th>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Fuente</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 whitespace-nowrap">Scanned</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((it) => (
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
                    <a className="text-core-700 hover:underline" href={it.url} target="_blank" rel="noreferrer">
                      {it.title ?? it.url}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-xs text-gris-500">{it.source ?? '—'}</td>
                  <td className="px-3 py-2">{it.status}</td>
                  <td className="px-3 py-2 text-gris-500 whitespace-nowrap">{new Date(it.scannedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-gris-300/60 text-sm">
            <span className="text-gris-500">Página {page + 1} de {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="ghost" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>← Anterior</Button>
              <Button variant="ghost" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>Siguiente →</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
