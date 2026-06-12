'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { api } from '@/lib/api';
import { Icon } from './Icon';

const STORAGE_BUCKET = 'career-ops';

type FeedbackType = 'error' | 'sugerencia' | 'funcion_faltante' | 'comentario_general';

const TYPES: { value: FeedbackType; label: string; icon: string }[] = [
  { value: 'error',              label: 'Error',             icon: 'bug_report' },
  { value: 'sugerencia',         label: 'Sugerencia',        icon: 'lightbulb' },
  { value: 'funcion_faltante',   label: 'Función faltante',  icon: 'add_circle' },
  { value: 'comentario_general', label: 'Comentario general', icon: 'chat' },
];

function browserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function FeedbackLauncher() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [type, setType] = useState<FeedbackType>('sugerencia');
  const [description, setDescription] = useState('');
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRating(0); setHover(0); setType('sugerencia'); setDescription('');
    setRecommend(null); setScreenshotPath(null); setFileName(null);
    setUploading(false); setSubmitting(false); setDone(false); setError(null);
  }

  function close() {
    setOpen(false);
    // Pequeño delay para no ver el reset durante el cierre.
    setTimeout(reset, 200);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('La captura debe ser una imagen.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no puede superar 5 MB.'); return; }
    setError(null);
    setUploading(true);
    try {
      const supabase = browserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesión no encontrada.');
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
      const path = `${user.id}/feedback/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      setScreenshotPath(path);
      setFileName(file.name);
    } catch (err) {
      setError(`No se pudo subir la captura: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (rating === 0) { setError('Elegí una calificación de 1 a 5 estrellas.'); return; }
    if (!description.trim()) { setError('Escribí una descripción.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/feedback', {
        rating,
        type,
        description: description.trim(),
        screenshotPath,
        wouldRecommend: recommend,
      });
      setDone(true);
    } catch (err) {
      setError(`No se pudo enviar: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-core px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-core/30 hover:bg-core-500 active:scale-[0.97] transition"
        aria-label="Enviar sugerencia"
      >
        <Icon name="rate_review" size={20} />
        <span className="hidden sm:inline">Enviar sugerencia</span>
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* overlay */}
          <div className="absolute inset-0 bg-black/40" onClick={close} />

          {/* panel */}
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gris-300 px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-intel-700">Enviar sugerencia</h2>
              <button onClick={close} className="p-1 rounded text-gris-500 hover:bg-gris-100" aria-label="Cerrar">
                <Icon name="close" size={22} />
              </button>
            </div>

            {done ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-lima/20 flex items-center justify-center">
                  <Icon name="check_circle" size={36} className="text-[#346538]" />
                </div>
                <p className="text-lg font-semibold text-intel-700">¡Gracias por tu feedback!</p>
                <p className="text-sm text-gris-500 mt-1">Lo revisaremos pronto.</p>
                <button onClick={close} className="mt-6 px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90">
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="px-5 py-5 space-y-5">
                {/* Estrellas */}
                <div>
                  <label className="block text-xs font-medium text-gris-700 mb-2">¿Cómo calificás la experiencia?</label>
                  <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        onMouseEnter={() => setHover(n)}
                        className="p-0.5 transition active:scale-90"
                        aria-label={`${n} estrellas`}
                      >
                        <Icon name="star" size={34} fill={(hover || rating) >= n}
                          className={(hover || rating) >= n ? 'text-amarillo' : 'text-gris-300'} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-xs font-medium text-gris-700 mb-2">Tipo de comentario</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
                          type === t.value
                            ? 'border-core bg-core/10 text-intel-700 font-semibold'
                            : 'border-gris-300 text-gris-700 hover:bg-gris-50'
                        }`}
                      >
                        <Icon name={t.icon} size={18} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-medium text-gris-700 mb-2">Descripción</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Contanos qué pasó o qué mejorarías…"
                    className="w-full rounded-lg border border-gris-300 bg-white px-3 py-2 text-sm text-intel-700 placeholder:text-gris-300 focus:outline-none focus:border-core resize-none"
                  />
                </div>

                {/* Captura */}
                <div>
                  <label className="block text-xs font-medium text-gris-700 mb-2">Captura de pantalla (opcional)</label>
                  {screenshotPath ? (
                    <div className="flex items-center gap-2 text-sm text-[#346538] bg-lima/10 border border-lima/30 rounded-lg px-3 py-2">
                      <Icon name="image" size={18} />
                      <span className="truncate flex-1">{fileName}</span>
                      <button onClick={() => { setScreenshotPath(null); setFileName(null); }} className="text-gris-500 hover:text-[#9F2F2D]">
                        <Icon name="close" size={18} />
                      </button>
                    </div>
                  ) : (
                    <label className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-gris-300 px-3 py-2 text-sm text-gris-500 cursor-pointer hover:border-core hover:text-intel-700 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                      <Icon name="photo_camera" size={18} />
                      {uploading ? 'Subiendo…' : 'Adjuntar imagen'}
                      <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                    </label>
                  )}
                </div>

                {/* Recomendación */}
                <div>
                  <label className="block text-xs font-medium text-gris-700 mb-2">¿Recomendarías career-ops a un colega?</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setRecommend(true)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm transition ${
                        recommend === true ? 'border-core bg-core/10 text-intel-700 font-semibold' : 'border-gris-300 text-gris-700 hover:bg-gris-50'}`}>
                      <Icon name="thumb_up" size={18} /> Sí
                    </button>
                    <button type="button" onClick={() => setRecommend(false)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm transition ${
                        recommend === false ? 'border-[#9F2F2D] bg-[#FDEBEC] text-[#9F2F2D] font-semibold' : 'border-gris-300 text-gris-700 hover:bg-gris-50'}`}>
                      <Icon name="thumb_down" size={18} /> No
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="px-3 py-2 bg-[#FDEBEC] rounded-lg text-sm text-[#9F2F2D]">{error}</div>
                )}

                <button
                  onClick={submit}
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-core px-4 py-2.5 text-sm font-semibold text-white hover:bg-core-500 active:scale-[0.99] transition disabled:bg-gris-300"
                >
                  <Icon name="send" size={18} />
                  {submitting ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
