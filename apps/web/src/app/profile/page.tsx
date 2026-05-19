'use client';

import { Suspense, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Tabs } from '@/components/Tabs';
import { api } from '@/lib/api';

interface ProfileData {
  fullName: string;
  email: string;
  phone: string | null;
  location: string | null;
  timezone: string | null;
  linkedin: string | null;
  portfolioUrl: string | null;
  github: string | null;
  narrative: string | null;
  archetypes: Array<{ name: string; level: string; fit: string }>;
  superpowers: string[];
  compTargetMin: number | null;
  compTargetMax: number | null;
  compCurrency: string;
  languageMode: 'en' | 'es' | 'de' | 'fr' | 'ja';
}

const TABS = [
  { key: 'info',       label: 'Info',       icon: 'person' },
  { key: 'cv',         label: 'CV',         icon: 'description' },
  { key: 'archetypes', label: 'Archetypes', icon: 'flag' },
  { key: 'comp',       label: 'Comp',       icon: 'payments' },
  { key: 'idiomas',    label: 'Idiomas',    icon: 'language' },
];

function ProfileContent() {
  const [p, setP] = useState<ProfileData | null>(null);
  const [cv, setCv] = useState('');
  const [cvLoading, setCvLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadProfile() {
    const r = await api.get<{ profile: any }>('/api/profile');
    if (r.profile) {
      setP({
        fullName: r.profile.fullName,
        email: r.profile.email,
        phone: r.profile.phone,
        location: r.profile.location,
        timezone: r.profile.timezone,
        linkedin: r.profile.linkedin,
        portfolioUrl: r.profile.portfolioUrl,
        github: r.profile.github,
        narrative: r.profile.narrative,
        archetypes: r.profile.archetypes ?? [],
        superpowers: r.profile.superpowers ?? [],
        compTargetMin: r.profile.compTargetMin,
        compTargetMax: r.profile.compTargetMax,
        compCurrency: r.profile.compCurrency ?? 'USD',
        languageMode: r.profile.languageMode ?? 'es',
      });
    }
  }
  async function loadCv() {
    setCvLoading(true);
    const r = await api.get<{ cv: { contentMd: string } | null }>('/api/profile/cv');
    setCv(r.cv?.contentMd ?? '');
    setCvLoading(false);
  }

  useEffect(() => { loadProfile(); loadCv(); }, []);

  async function saveProfile() {
    if (!p) return;
    setSaving(true);
    try {
      await api.put('/api/profile', {
        full_name: p.fullName, email: p.email, phone: p.phone, location: p.location,
        timezone: p.timezone, linkedin: p.linkedin, portfolio_url: p.portfolioUrl, github: p.github,
        narrative: p.narrative, archetypes: p.archetypes, superpowers: p.superpowers,
        comp_target_min: p.compTargetMin, comp_target_max: p.compTargetMax,
        comp_currency: p.compCurrency, language_mode: p.languageMode,
      });
    } finally {
      setSaving(false);
    }
  }
  async function saveCv() {
    setSaving(true);
    try { await api.put('/api/profile/cv', { content_md: cv }); }
    finally { setSaving(false); }
  }

  function updateArchetype(idx: number, key: keyof ProfileData['archetypes'][number], val: string) {
    if (!p) return;
    const arch = [...p.archetypes];
    arch[idx] = { ...arch[idx]!, [key]: val };
    setP({ ...p, archetypes: arch });
  }
  function addArchetype() {
    if (!p) return;
    setP({ ...p, archetypes: [...p.archetypes, { name: '', level: 'Senior', fit: 'primary' }] });
  }
  function removeArchetype(idx: number) {
    if (!p) return;
    setP({ ...p, archetypes: p.archetypes.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-h1 text-intel-700">Perfil</h1>
      </div>

      <Tabs tabs={TABS} defaultTab="info">
        {(active) => {
          if (!p) return <Card><p className="text-gris-500 p-4">Cargando…</p></Card>;

          if (active === 'info') {
            return (
              <Card className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Nombre completo" value={p.fullName} onChange={(v) => setP({ ...p, fullName: v })} />
                  <Field label="Email"           value={p.email}    onChange={(v) => setP({ ...p, email: v })} />
                  <Field label="Teléfono"        value={p.phone ?? ''} onChange={(v) => setP({ ...p, phone: v || null })} />
                  <Field label="Ubicación"       value={p.location ?? ''} onChange={(v) => setP({ ...p, location: v || null })} />
                  <Field label="Timezone"        value={p.timezone ?? ''} onChange={(v) => setP({ ...p, timezone: v || null })} />
                  <Field label="LinkedIn"        value={p.linkedin ?? ''} onChange={(v) => setP({ ...p, linkedin: v || null })} />
                  <Field label="Portfolio URL"   value={p.portfolioUrl ?? ''} onChange={(v) => setP({ ...p, portfolioUrl: v || null })} />
                  <Field label="GitHub"          value={p.github ?? ''} onChange={(v) => setP({ ...p, github: v || null })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-intel-700 mb-1">Narrativa profesional</label>
                  <textarea
                    className="w-full min-h-[160px] rounded border border-gris-300 p-3 text-sm"
                    value={p.narrative ?? ''}
                    onChange={(e) => setP({ ...p, narrative: e.target.value || null })}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveProfile} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
                </div>
              </Card>
            );
          }

          if (active === 'cv') {
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-end">
                  <Button onClick={saveCv} disabled={saving || cvLoading}>{saving ? 'Guardando…' : 'Guardar nueva versión'}</Button>
                </div>
                {cvLoading ? (
                  <Card><p className="text-gris-500 p-4 text-center">Cargando CV…</p></Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="p-0 overflow-hidden">
                      <textarea
                        value={cv}
                        onChange={(e) => setCv(e.target.value)}
                        className="w-full h-[65vh] font-mono text-sm p-4 outline-none resize-none"
                        spellCheck={false}
                      />
                    </Card>
                    <Card>
                      <div className="prose-coreintel max-w-none h-[65vh] overflow-y-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cv}</ReactMarkdown>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            );
          }

          if (active === 'archetypes') {
            return (
              <Card className="space-y-3">
                <p className="text-sm text-gris-500">
                  Los archetypes le dicen al evaluador qué tipo de rol estás buscando. Marca máx 3 primary.
                </p>
                <div className="space-y-2">
                  {p.archetypes.map((a, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-center">
                      <input
                        value={a.name}
                        onChange={(e) => updateArchetype(i, 'name', e.target.value)}
                        className="flex-1 min-w-[200px] rounded border border-gris-300 px-3 py-1.5 text-sm"
                        placeholder="Nombre (ej. Gerente de Operaciones)"
                      />
                      <input
                        value={a.level}
                        onChange={(e) => updateArchetype(i, 'level', e.target.value)}
                        className="w-40 rounded border border-gris-300 px-3 py-1.5 text-sm"
                        placeholder="Senior, Mid…"
                      />
                      <select
                        value={a.fit}
                        onChange={(e) => updateArchetype(i, 'fit', e.target.value)}
                        className="rounded border border-gris-300 px-2 py-1.5 text-sm"
                      >
                        <option value="primary">primary</option>
                        <option value="secondary">secondary</option>
                        <option value="adjacent">adjacent</option>
                      </select>
                      <button onClick={() => removeArchetype(i)} className="text-red-600 text-sm hover:underline">Quitar</button>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" onClick={addArchetype}>+ Agregar archetype</Button>
                <div className="flex justify-end">
                  <Button onClick={saveProfile} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
                </div>
              </Card>
            );
          }

          if (active === 'comp') {
            return (
              <Card className="space-y-3">
                <p className="text-sm text-gris-500">
                  Compensación objetivo mensual. Se usa para filtrar ofertas en la evaluación.
                </p>
                <div className="grid md:grid-cols-3 gap-3">
                  <NumField label="Mínimo (walk-away)" value={p.compTargetMin} onChange={(v) => setP({ ...p, compTargetMin: v })} />
                  <NumField label="Objetivo"           value={p.compTargetMax} onChange={(v) => setP({ ...p, compTargetMax: v })} />
                  <label className="block">
                    <span className="block text-sm font-semibold text-intel-700 mb-1">Moneda</span>
                    <select
                      value={p.compCurrency}
                      onChange={(e) => setP({ ...p, compCurrency: e.target.value })}
                      className="w-full rounded border border-gris-300 px-3 py-1.5 text-sm"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="CRC">CRC</option>
                    </select>
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveProfile} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
                </div>
              </Card>
            );
          }

          if (active === 'idiomas') {
            return (
              <Card className="space-y-3">
                <p className="text-sm text-gris-500">
                  Idioma de los modos de evaluación. Cambia el tono del report y las decisiones.
                </p>
                <label className="block max-w-xs">
                  <span className="block text-sm font-semibold text-intel-700 mb-1">Idioma activo</span>
                  <select
                    value={p.languageMode}
                    onChange={(e) => setP({ ...p, languageMode: e.target.value as ProfileData['languageMode'] })}
                    className="w-full rounded border border-gris-300 px-3 py-1.5 text-sm"
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                    <option value="de">Deutsch (DACH)</option>
                    <option value="fr">Français</option>
                    <option value="ja">日本語</option>
                  </select>
                </label>
                <div className="flex justify-end">
                  <Button onClick={saveProfile} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
                </div>
              </Card>
            );
          }

          return null;
        }}
      </Tabs>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-gris-500">Cargando…</p>}>
      <ProfileContent />
    </Suspense>
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
