'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';

export default function CvPage() {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ cv: { content_md: string } | null }>('/api/profile/cv').then((r) => setContent(r.cv?.content_md ?? ''));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put('/api/profile/cv', { content_md: content });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-intel-700">CV</h1>
        <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar nueva versión'}</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-0">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-[70vh] font-mono text-sm p-4 outline-none resize-none"
            placeholder="# Tu CV en markdown"
          />
        </Card>
        <Card>
          <div className="prose-coreintel max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </Card>
      </div>
    </div>
  );
}
