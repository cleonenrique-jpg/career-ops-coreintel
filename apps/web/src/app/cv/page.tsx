'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';

export default function CvPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    api.get<{ cv: { contentMd: string } | null }>('/api/profile/cv')
      .then((r) => setContent(r.cv?.contentMd ?? ''))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put('/api/profile/cv', { content_md: content });
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-h1 text-intel-700">CV</h1>
          <p className="text-text-muted text-sm">
            Markdown — se usa como input para evaluaciones y para el PDF generado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-sm text-gris-500">Guardado {savedAt.toLocaleTimeString()}</span>}
          <Button onClick={save} disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar nueva versión'}
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-16 text-gris-500">
            <svg className="animate-spin h-5 w-5 mr-3 text-core" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" />
            </svg>
            Cargando CV…
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-0 overflow-hidden">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-[70vh] font-mono text-sm p-4 outline-none resize-none"
              placeholder="# Tu CV en markdown"
              spellCheck={false}
            />
          </Card>
          <Card>
            <div className="prose-coreintel max-w-none h-[70vh] overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
