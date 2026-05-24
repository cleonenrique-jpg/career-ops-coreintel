'use client';

import { Suspense, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  { key: 'info',       label: 'Información' },
  { key: 'cv',         label: 'CV' },
  { key: 'archetypes', label: 'Archetypes' },
  { key: 'comp',       label: 'Comp' },
  { key: 'idiomas',    label: 'Idiomas' },
] as const;
type TabKey = typeof TABS[number]['key'];

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-2">{label}</span>
      <input
        className="w-full border-0 border-b border-[#EAEAEA] bg-transparent px-0 py-2 text-base text-intel-700 placeholder:text-gris-300 focus:outline-none focus:border-intel-700 transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-2">{label}</span>
      <input
        type="number"
        className="w-full border-0 border-b border-[#EAEAEA] bg-transparent px-0 py-2 text-base text-intel-700 font-mono focus:outline-none focus:border-intel-700 transition-colors"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      />
    </label>
  );
}

function ProfileContent() {
  const [p, setP] = useState<ProfileData | null>(null);
  const [cv, setCv] = useState('');
  const [cvLoading, setCvLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<TabKey>('info');

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

  const FIT_STYLE: Record<string, string> = {
    primary: 'bg-[#E1F3FE] text-[#1F6C9F]',
    secondary: 'bg-[#FBF3DB] text-[#7a5d00]',
    adjacent: 'bg-[#F3F3F1] text-gris-500',
  };

  return (
    <div className="editorial-font min-h-screen bg-[#FBFBFA] -mx-6 -my-8 px-6 py-12 md:px-12 md:py-16">
      <div className="max-w-5xl mx-auto space-y-12">

        <header className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
            Coreintel · Career Ops
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-intel-700 tracking-[-0.02em] leading-[1.05]">
            Perfil
          </h1>
          {p && (
            <p className="text-base text-gris-500 leading-relaxed font-mono">
              {p.fullName} · {p.email}
            </p>
          )}
        </header>

        <nav className="flex flex-wrap gap-6 md:gap-8 border-b border-[#EAEAEA]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`pb-3 text-sm font-medium transition relative ${
                active === t.key ? 'text-intel-700' : 'text-gris-500 hover:text-intel-700'
              }`}
            >
              {t.label}
              {active === t.key && <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-intel-700" />}
            </button>
          ))}
        </nav>

        {!p && (
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-12 text-center text-gris-500 text-sm">
            Cargando…
          </div>
        )}

        {p && active === 'info' && (
          <section className="bg-white border border-[#EAEAEA] rounded-xl p-8 md:p-10 space-y-8">
            <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
              Información personal
            </h2>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
              <Field label="Nombre completo" value={p.fullName} onChange={(v) => setP({ ...p, fullName: v })} />
              <Field label="Email"           value={p.email}    onChange={(v) => setP({ ...p, email: v })} />
              <Field label="Teléfono"        value={p.phone ?? ''} onChange={(v) => setP({ ...p, phone: v || null })} />
              <Field label="Ubicación"       value={p.location ?? ''} onChange={(v) => setP({ ...p, location: v || null })} />
              <Field label="Timezone"        value={p.timezone ?? ''} onChange={(v) => setP({ ...p, timezone: v || null })} />
              <Field label="LinkedIn"        value={p.linkedin ?? ''} onChange={(v) => setP({ ...p, linkedin: v || null })} />
              <Field label="Portfolio"       value={p.portfolioUrl ?? ''} onChange={(v) => setP({ ...p, portfolioUrl: v || null })} />
              <Field label="GitHub"          value={p.github ?? ''} onChange={(v) => setP({ ...p, github: v || null })} />
            </div>
            <div className="pt-6 border-t border-[#F3F3F1]">
              <span className="block text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-2">
                Narrativa profesional
              </span>
              <textarea
                className="w-full min-h-[200px] rounded-md border border-[#EAEAEA] bg-[#FBFBFA] p-4 text-sm text-intel-700 leading-relaxed focus:outline-none focus:border-intel-700 transition-colors"
                value={p.narrative ?? ''}
                onChange={(e) => setP({ ...p, narrative: e.target.value || null })}
                placeholder="Tu historia profesional en 2-3 párrafos…"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </section>
        )}

        {p && active === 'cv' && (
          <section className="space-y-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
                CV Markdown
              </h2>
              <button
                onClick={saveCv}
                disabled={saving || cvLoading}
                className="px-4 py-1.5 text-xs font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
              >
                {saving ? 'Guardando…' : 'Guardar nueva versión'}
              </button>
            </div>
            {cvLoading ? (
              <div className="bg-white border border-[#EAEAEA] rounded-xl p-12 text-center text-gris-500 text-sm">
                Cargando CV…
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium px-4 py-2 border-b border-[#F3F3F1]">
                    Editor
                  </div>
                  <textarea
                    value={cv}
                    onChange={(e) => setCv(e.target.value)}
                    className="w-full h-[65vh] font-mono text-xs p-4 outline-none resize-none text-intel-700 leading-relaxed"
                    spellCheck={false}
                  />
                </div>
                <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium px-4 py-2 border-b border-[#F3F3F1]">
                    Preview
                  </div>
                  <div className="prose-coreintel max-w-none h-[65vh] overflow-y-auto p-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{cv}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {p && active === 'archetypes' && (
          <section className="bg-white border border-[#EAEAEA] rounded-xl p-8 md:p-10 space-y-6">
            <div>
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium mb-3">
                Roles objetivo
              </h2>
              <p className="text-sm text-gris-500 leading-relaxed">
                Los archetypes le dicen al evaluador qué tipo de rol estás buscando. Máximo 3 <code className="bg-[#F5F5F7] px-1.5 py-0.5 rounded text-[11px] text-intel-700">primary</code>.
              </p>
            </div>
            <div className="space-y-3">
              {p.archetypes.map((a, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center pb-3 border-b border-[#F3F3F1] last:border-0">
                  <input
                    value={a.name}
                    onChange={(e) => updateArchetype(i, 'name', e.target.value)}
                    className="border-0 border-b border-[#EAEAEA] bg-transparent px-0 py-1 text-sm text-intel-700 focus:outline-none focus:border-intel-700 transition-colors"
                    placeholder="Nombre (ej. Gerente de Operaciones)"
                  />
                  <input
                    value={a.level}
                    onChange={(e) => updateArchetype(i, 'level', e.target.value)}
                    className="w-32 border border-[#EAEAEA] rounded-md px-3 py-1.5 text-xs text-intel-700 focus:outline-none focus:border-intel-700"
                    placeholder="Senior, Mid…"
                  />
                  <select
                    value={a.fit}
                    onChange={(e) => updateArchetype(i, 'fit', e.target.value)}
                    className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.1em] font-semibold border-0 focus:outline-none ${FIT_STYLE[a.fit] ?? 'bg-[#F3F3F1] text-gris-500'}`}
                  >
                    <option value="primary">primary</option>
                    <option value="secondary">secondary</option>
                    <option value="adjacent">adjacent</option>
                  </select>
                  <button
                    onClick={() => removeArchetype(i)}
                    className="text-xs text-gris-500 hover:text-[#9F2F2D] transition"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={addArchetype}
                className="px-3 py-1.5 text-xs font-medium rounded border border-[#EAEAEA] text-intel-700 hover:bg-[#F5F5F7] active:scale-[0.98] transition"
              >
                + Agregar archetype
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </section>
        )}

        {p && active === 'comp' && (
          <section className="bg-white border border-[#EAEAEA] rounded-xl p-8 md:p-10 space-y-8">
            <div>
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium mb-3">
                Compensación objetivo
              </h2>
              <p className="text-sm text-gris-500 leading-relaxed">
                Rango mensual usado para filtrar ofertas en la evaluación.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-x-8 gap-y-6">
              <NumField label="Mínimo (walk-away)" value={p.compTargetMin} onChange={(v) => setP({ ...p, compTargetMin: v })} />
              <NumField label="Objetivo" value={p.compTargetMax} onChange={(v) => setP({ ...p, compTargetMax: v })} />
              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-2">Moneda</span>
                <select
                  value={p.compCurrency}
                  onChange={(e) => setP({ ...p, compCurrency: e.target.value })}
                  className="w-full border-0 border-b border-[#EAEAEA] bg-transparent px-0 py-2 text-base text-intel-700 font-mono focus:outline-none focus:border-intel-700 transition-colors"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CRC">CRC</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </section>
        )}

        {p && active === 'idiomas' && (
          <section className="bg-white border border-[#EAEAEA] rounded-xl p-8 md:p-10 space-y-8">
            <div>
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium mb-3">
                Idioma de evaluación
              </h2>
              <p className="text-sm text-gris-500 leading-relaxed">
                Cambia el tono del report y las decisiones del evaluador.
              </p>
            </div>
            <label className="block max-w-sm">
              <span className="block text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-2">Idioma activo</span>
              <select
                value={p.languageMode}
                onChange={(e) => setP({ ...p, languageMode: e.target.value as ProfileData['languageMode'] })}
                className="w-full border-0 border-b border-[#EAEAEA] bg-transparent px-0 py-2 text-base text-intel-700 focus:outline-none focus:border-intel-700 transition-colors"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="de">Deutsch (DACH)</option>
                <option value="fr">Français</option>
                <option value="ja">日本語</option>
              </select>
            </label>
            <div className="flex justify-end pt-2">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </section>
        )}
      </div>
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
