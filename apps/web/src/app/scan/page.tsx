'use client';

import { useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';

export default function ScanPage() {
  const [msg, setMsg] = useState<string | null>(null);

  async function runScan() {
    const r = await api.post<{ accepted: boolean; note?: string }>('/api/scan/run', {});
    setMsg(r.note ?? 'Scan disparado.');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-h1 text-intel-700">Scan</h1>
      <Card>
        <p className="text-text-muted">
          El escáner corre cada 6h en Railway. Si querés un scan manual ahora, dispará desde Railway o usá el botón:
        </p>
        <div className="mt-3"><Button onClick={runScan}>Disparar scan ahora</Button></div>
        {msg && <p className="mt-3 text-sm text-intel-700">{msg}</p>}
      </Card>
    </div>
  );
}
