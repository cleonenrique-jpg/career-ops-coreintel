'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';

interface Profile {
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  timezone: string | null;
  linkedin: string | null;
  narrative: string | null;
  archetypes: Array<{ name: string; level: string; fit: string }>;
  superpowers: string[];
  comp_target_min: number | null;
  comp_target_max: number | null;
  comp_currency: string;
  language_mode: 'en' | 'es' | 'de' | 'fr' | 'ja';
}

const empty: Profile = {
  full_name: '', email: '', phone: null, location: null, timezone: null, linkedin: null,
  narrative: null, archetypes: [], superpowers: [],
  comp_target_min: null, comp_target_max: null, comp_currency: 'USD', language_mode: 'es',
};

export default function ProfilePage() {
  const [p, setP] = useState<Profile>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ profile: any }>('/api/profile').then((r) => {
      if (r.profile) {
        setP({
          full_name: r.profile.fullName,
          email: r.profile.email,
          phone: r.profile.phone,
          location: r.profile.location,
          timezone: r.profile.timezone,
          linkedin: r.profile.linkedin,
          narrative: r.profile.narrative,
          archetypes: r.profile.archetypes ?? [],
          superpowers: r.profile.superpowers ?? [],
          comp_target_min: r.profile.compTargetMin,
          comp_target_max: r.profile.compTargetMax,
          comp_currency: r.profile.compCurrency ?? 'USD',
          language_mode: r.profile.languageMode ?? 'es',
        });
      }
    });
  }, []);

  async function save() {
    setSaving(true);
    try { await api.put('/api/profile', p); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-intel-700">Profile</h1>
        <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
      </div>

      <Card className="grid md:grid-cols-2 gap-4">
        <Field label="Nombre completo" value={p.full_name} onChange={(v) => setP({ ...p, full_name: v })} />
        <Field label="Email" value={p.email} onChange={(v) => setP({ ...p, email: v })} />
        <Field label="Teléfono" value={p.phone ?? ''} onChange={(v) => setP({ ...p, phone: v || null })} />
        <Field label="Ubicación" value={p.location ?? ''} onChange={(v) => setP({ ...p, location: v || null })} />
        <Field label="Timezone" value={p.timezone ?? ''} onChange={(v) => setP({ ...p, timezone: v || null })} />
        <Field label="LinkedIn" value={p.linkedin ?? ''} onChange={(v) => setP({ ...p, linkedin: v || null })} />
        <NumField label="Comp mínimo (mensual)" value={p.comp_target_min} onChange={(v) => setP({ ...p, comp_target_min: v })} />
        <NumField label="Comp objetivo (mensual)" value={p.comp_target_max} onChange={(v) => setP({ ...p, comp_target_max: v })} />
      </Card>

      <Card>
        <label className="block text-sm font-semibold text-intel-700 mb-1">Narrativa profesional</label>
        <textarea
          className="w-full min-h-[160px] rounded border border-gris-300 p-3 text-sm"
          value={p.narrative ?? ''}
          onChange={(e) => setP({ ...p, narrative: e.target.value || null })}
        />
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-intel-700 mb-1">{label}</span>
      <input className="w-full rounded border border-gris-300 px-3 py-1.5 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-intel-700 mb-1">{label}</span>
      <input
        type="number"
        className="w-full rounded border border-gris-300 px-3 py-1.5 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      />
    </label>
  );
}
