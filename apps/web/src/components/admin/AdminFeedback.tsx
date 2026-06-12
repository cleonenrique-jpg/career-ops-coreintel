'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '../Icon';

type FeedbackType = 'error' | 'sugerencia' | 'funcion_faltante' | 'comentario_general';
type Category = 'bug' | 'ux' | 'nueva_funcionalidad' | 'rendimiento' | 'contenido' | 'monetizacion';
type Priority = 'baja' | 'media' | 'alta' | 'critica';
type Status = 'nuevo' | 'en_revision' | 'planificado' | 'en_progreso' | 'resuelto' | 'descartado';

interface Feedback {
  id: string;
  userEmail: string;
  rating: number;
  type: FeedbackType;
  description: string;
  screenshotPath: string | null;
  wouldRecommend: boolean | null;
  category: Category | null;
  priority: Priority | null;
  status: Status;
  createdAt: string;
}

const TYPE_LABEL: Record<FeedbackType, string> = {
  error: 'Error', sugerencia: 'Sugerencia', funcion_faltante: 'Función faltante', comentario_general: 'Comentario general',
};
const CATEGORY_OPTS: { value: Category; label: string }[] = [
  { value: 'bug', label: 'Bug/Error' },
  { value: 'ux', label: 'UX' },
  { value: 'nueva_funcionalidad', label: 'Nueva funcionalidad' },
  { value: 'rendimiento', label: 'Rendimiento' },
  { value: 'contenido', label: 'Contenido' },
  { value: 'monetizacion', label: 'Monetización' },
];
const PRIORITY_OPTS: { value: Priority; label: string }[] = [
  { value: 'baja', label: 'Baja' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Alta' }, { value: 'critica', label: 'Crítica' },
];
const STATUS_OPTS: { value: Status; label: string }[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'planificado', label: 'Planificado' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'descartado', label: 'Descartado' },
];
const PRIORITY_PILL: Record<Priority, string> = {
  baja: 'text-gris-500', media: 'text-[#1F6C9F]', alta: 'text-[#7a5d00]', critica: 'text-[#9F2F2D]',
};

export function AdminFeedback() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState<string>('');
  const [fCategory, setFCategory] = useState<string>('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (fStatus) qs.set('status', fStatus);
      if (fCategory) qs.set('category', fCategory);
      const res = await api.get<{ feedback: Feedback[] }>(`/api/admin/feedback${qs.toString() ? `?${qs}` : ''}`);
      setItems(res.feedback);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fStatus, fCategory]);

  async function patch(id: string, body: Partial<Pick<Feedback, 'category' | 'priority' | 'status'>>) {
    // Optimista
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...body } : it)));
    try {
      await api.patch(`/api/admin/feedback/${id}`, body);
    } catch (e) {
      alert((e as Error).message);
      load();
    }
  }

  async function viewScreenshot(id: string) {
    try {
      const res = await api.get<{ url: string }>(`/api/admin/feedback/${id}/screenshot`);
      window.open(res.url, '_blank', 'noopener');
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
          Feedback <span className="text-gris-300">·</span> {items.length}
        </h2>
        <div className="flex items-center gap-2">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
            className="border border-[#EAEAEA] rounded-md bg-white px-2.5 py-1.5 text-xs text-intel-700 focus:outline-none focus:border-intel-700">
            <option value="">Todos los estados</option>
            {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}
            className="border border-[#EAEAEA] rounded-md bg-white px-2.5 py-1.5 text-xs text-intel-700 focus:outline-none focus:border-intel-700">
            <option value="">Todas las categorías</option>
            {CATEGORY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={load} disabled={loading} className="text-xs text-gris-500 hover:text-intel-700 transition disabled:opacity-50">
            {loading ? 'Cargando…' : 'Recargar'}
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-3 bg-[#FDEBEC] rounded-lg text-sm text-[#9F2F2D]">{error}</div>}

      <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[920px]">
          <thead>
            <tr className="border-b border-[#EAEAEA]">
              {['ID', 'Usuario', 'Comentario', 'Categoría', 'Prioridad', 'Estado'].map((h) => (
                <th key={h} className="text-left px-4 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((f, idx) => (
              <tr key={f.id} className={`${idx !== items.length - 1 ? 'border-b border-[#F3F3F1]' : ''} hover:bg-[#FBFBFA] transition-colors align-top`}>
                <td className="px-4 py-4 text-[11px] text-gris-500 font-mono whitespace-nowrap">
                  {f.id.slice(0, 8)}
                  <div className="text-gris-300 mt-1">{new Date(f.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}</div>
                </td>
                <td className="px-4 py-4 text-intel-700 max-w-[160px]">
                  <div className="truncate" title={f.userEmail}>{f.userEmail}</div>
                </td>
                <td className="px-4 py-4 text-gris-700 max-w-[320px]">
                  <p className="whitespace-pre-wrap break-words">{f.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gris-500">
                    <span className="inline-flex items-center gap-0.5 text-amarillo">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Icon key={i} name="star" size={13} fill={i < f.rating} className={i < f.rating ? 'text-amarillo' : 'text-gris-300'} />
                      ))}
                    </span>
                    <span className="rounded bg-gris-100 px-1.5 py-0.5">{TYPE_LABEL[f.type]}</span>
                    {f.wouldRecommend != null && (
                      <span className={f.wouldRecommend ? 'text-[#346538]' : 'text-[#9F2F2D]'}>
                        {f.wouldRecommend ? '👍 recomienda' : '👎 no recomienda'}
                      </span>
                    )}
                    {f.screenshotPath && (
                      <button onClick={() => viewScreenshot(f.id)} className="inline-flex items-center gap-0.5 text-core-700 hover:underline">
                        <Icon name="image" size={13} /> captura
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <select value={f.category ?? ''} onChange={(e) => patch(f.id, { category: (e.target.value || null) as Category | null })}
                    className="border border-[#EAEAEA] rounded-md bg-white px-2 py-1.5 text-xs text-intel-700 focus:outline-none focus:border-intel-700">
                    <option value="">— sin clasificar</option>
                    {CATEGORY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-4">
                  <select value={f.priority ?? ''} onChange={(e) => patch(f.id, { priority: (e.target.value || null) as Priority | null })}
                    className={`border border-[#EAEAEA] rounded-md bg-white px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-intel-700 ${f.priority ? PRIORITY_PILL[f.priority] : 'text-gris-500'}`}>
                    <option value="">—</option>
                    {PRIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-4">
                  <select value={f.status} onChange={(e) => patch(f.id, { status: e.target.value as Status })}
                    className="border border-[#EAEAEA] rounded-md bg-white px-2 py-1.5 text-xs text-intel-700 focus:outline-none focus:border-intel-700">
                    {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gris-500 text-sm">Sin feedback todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
