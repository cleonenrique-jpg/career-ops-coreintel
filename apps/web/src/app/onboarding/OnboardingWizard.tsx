'use client';

// Wizard de onboarding self-serve (3 pasos): CV → perfil → activación.
// El usuario llega con status=pending; al completar queda active y su
// primer scan se encola automáticamente.

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/Icon';

type Seniority = 'junior' | 'mid' | 'senior' | 'lead' | 'executive';

interface Parsed {
  cvMarkdown: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  targetRoles: string[];
  seniority: Seniority;
  superpowers: string[];
  narrative: string;
}

const SENIORITY_LABEL: Record<Seniority, string> = {
  junior: 'Junior', mid: 'Intermedio', senior: 'Senior', lead: 'Líder de equipo', executive: 'Ejecutivo / Gerencial',
};

const STEPS = ['Tu CV', 'Tu perfil', 'Activación'];

interface WizardProps {
  email: string;
  // Solo para preview/QA: arranca en un paso con datos de ejemplo.
  initialStep?: number;
  demo?: Partial<Parsed>;
}

export function OnboardingWizard({ email, initialStep = 0, demo }: WizardProps) {
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState<string | null>(null);

  // Paso 1
  const [cvText, setCvText] = useState('');
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Paso 2 (borrador editable)
  const [cvMarkdown, setCvMarkdown] = useState(demo?.cvMarkdown ?? '');
  const [fullName, setFullName] = useState(demo?.fullName ?? '');
  const [location, setLocation] = useState(demo?.location ?? '');
  const [linkedin, setLinkedin] = useState(demo?.linkedin ?? '');
  const [phone, setPhone] = useState(demo?.phone ?? '');
  const [roles, setRoles] = useState<string[]>(demo?.targetRoles ?? []);
  const [roleInput, setRoleInput] = useState('');
  const [seniority, setSeniority] = useState<Seniority>(demo?.seniority ?? 'mid');
  const [superpowers, setSuperpowers] = useState<string[]>(demo?.superpowers ?? []);
  const [narrative, setNarrative] = useState(demo?.narrative ?? '');
  const [compMin, setCompMin] = useState('');
  const [compMax, setCompMax] = useState('');

  // Paso 3
  const [activating, setActivating] = useState(false);
  const [done, setDone] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) {
      setError('Subí un archivo .txt o .md — si tu CV es PDF, abrilo y copiá/pegá el texto acá.');
      return;
    }
    setError(null);
    setCvText(await file.text());
  }

  async function analyze() {
    if (cvText.trim().length < 100) {
      setError('Pegá el texto completo de tu CV (mínimo unas líneas de experiencia).');
      return;
    }
    setError(null);
    setParsing(true);
    try {
      const res = await api.post<{ parsed: Parsed }>('/api/onboarding/parse-cv', { cvText });
      const p = res.parsed;
      setCvMarkdown(p.cvMarkdown);
      setFullName(p.fullName ?? '');
      setLocation(p.location ?? '');
      setLinkedin(p.linkedin ?? '');
      setPhone(p.phone ?? '');
      setRoles(p.targetRoles);
      setSeniority(p.seniority);
      setSuperpowers(p.superpowers);
      setNarrative(p.narrative);
      setStep(1);
    } catch (err) {
      setError(`No se pudo analizar el CV: ${(err as Error).message}`);
    } finally {
      setParsing(false);
    }
  }

  function addRole() {
    const r = roleInput.trim();
    if (r && roles.length < 5 && !roles.includes(r)) setRoles([...roles, r]);
    setRoleInput('');
  }

  async function activate() {
    setActivating(true);
    setError(null);
    try {
      await api.post('/api/onboarding/complete', {
        cvMarkdown,
        fullName,
        location: location || null,
        linkedin: linkedin || null,
        phone: phone || null,
        targetRoles: roles,
        seniority,
        superpowers,
        narrative: narrative || null,
        compTargetMin: compMin ? Number(compMin) : null,
        compTargetMax: compMax ? Number(compMax) : null,
        compCurrency: 'USD',
      });
      setDone(true);
    } catch (err) {
      setError(`No se pudo activar la cuenta: ${(err as Error).message}`);
    } finally {
      setActivating(false);
    }
  }

  const inputCls = 'w-full rounded-[14px] border border-hairline bg-white px-3 py-2 text-sm text-negro placeholder:text-gris-300 focus:outline-none focus:border-core';
  const labelCls = 'block text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-1.5';

  if (done) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-lima/20 flex items-center justify-center">
          <Icon name="rocket_launch" size={36} className="text-[#3a7d00]" />
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-negro">¡Tu cuenta está activa!</h1>
        <p className="text-gris-500 leading-relaxed">
          Tu primer escaneo de portales <strong className="text-negro">ya está corriendo</strong>.
          En los próximos minutos vas a ver tus primeras ofertas evaluadas contra tu perfil en el pipeline.
        </p>
        <button
          onClick={() => { window.location.href = '/'; }}
          className="inline-flex items-center gap-2 rounded-full bg-core px-6 py-2.5 text-sm font-semibold text-white hover:bg-core-500 active:scale-[0.97] transition"
        >
          Ir a mi pipeline <Icon name="arrow_forward" size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-8">
      {/* Encabezado + progreso */}
      <header className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
          Coreintel · Career Ops
        </div>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-negro">Configurá tu búsqueda</h1>
        <p className="text-gris-500">
          {email} · 3 pasos, menos de 5 minutos.
        </p>
        <div className="flex gap-2 pt-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                i < step ? 'bg-[#3a7d00] text-white' : i === step ? 'bg-core text-white' : 'bg-tile text-gris-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </span>
              <span className={`text-xs ${i === step ? 'text-negro font-semibold' : 'text-gris-500'}`}>{s}</span>
              {i < STEPS.length - 1 && <span className="w-6 h-px bg-hairline" />}
            </div>
          ))}
        </div>
      </header>

      {error && (
        <div className="px-4 py-3 bg-[#FDEBEC] rounded-[14px] text-sm text-[#9F2F2D]">{error}</div>
      )}

      {/* Paso 1 — CV */}
      {step === 0 && (
        <section className="rounded-3xl border border-hairline bg-white p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-negro">Pegá tu CV</h2>
            <p className="text-sm text-gris-500 mt-1">
              Copiá el texto completo de tu CV (desde el PDF, Word o LinkedIn) y pegalo acá.
              La IA lo va a convertir en tu perfil de búsqueda.
            </p>
          </div>
          <textarea
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            rows={12}
            placeholder={'Ej.:\nCarlos León\nGerente de Operaciones — 10 años de experiencia…\n\nEXPERIENCIA\nEmpresa X (2019-2024) — Gerente Regional…'}
            className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
          />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gris-500 cursor-pointer hover:text-negro">
              <Icon name="upload_file" size={18} />
              o subí un .txt / .md
              <input ref={fileRef} type="file" accept=".txt,.md" onChange={onFile} className="hidden" />
            </label>
            <button
              onClick={analyze}
              disabled={parsing}
              className="inline-flex items-center gap-2 rounded-full bg-core px-5 py-2.5 text-sm font-semibold text-white hover:bg-core-500 active:scale-[0.97] transition disabled:bg-gris-300"
            >
              {parsing ? (<><Icon name="hourglass_top" size={18} /> Analizando tu CV…</>) : (<><Icon name="auto_awesome" size={18} /> Analizar mi CV</>)}
            </button>
          </div>
        </section>
      )}

      {/* Paso 2 — Perfil */}
      {step === 1 && (
        <section className="rounded-3xl border border-hairline bg-white p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-negro">Revisá tu perfil</h2>
            <p className="text-sm text-gris-500 mt-1">La IA extrajo esto de tu CV. Corregí lo que haga falta — define qué ofertas vamos a buscar y cómo se evalúan.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Nombre completo</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Ubicación</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="San José, Costa Rica" className={inputCls} /></div>
            <div><label className={labelCls}>LinkedIn</label>
              <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/…" className={inputCls} /></div>
            <div><label className={labelCls}>Teléfono</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></div>
          </div>

          <div>
            <label className={labelCls}>Roles objetivo (máx. 5) — esto define qué buscamos</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {roles.map((r) => (
                <span key={r} className="inline-flex items-center gap-1 rounded-full bg-core/10 text-intel-700 px-3 py-1 text-sm font-medium">
                  {r}
                  <button onClick={() => setRoles(roles.filter((x) => x !== r))} className="text-gris-500 hover:text-[#9F2F2D]">
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }}
                placeholder="Ej. Gerente de Operaciones"
                className={inputCls}
              />
              <button onClick={addRole} className="shrink-0 rounded-full border border-hairline px-4 text-sm text-intel-700 hover:bg-tile">Agregar</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Seniority</label>
              <select value={seniority} onChange={(e) => setSeniority(e.target.value as Seniority)} className={inputCls}>
                {(Object.keys(SENIORITY_LABEL) as Seniority[]).map((s) => <option key={s} value={s}>{SENIORITY_LABEL[s]}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Salario objetivo mín. (USD/mes)</label>
              <input type="number" value={compMin} onChange={(e) => setCompMin(e.target.value)} placeholder="3000" className={inputCls} /></div>
            <div><label className={labelCls}>Salario objetivo máx.</label>
              <input type="number" value={compMax} onChange={(e) => setCompMax(e.target.value)} placeholder="5000" className={inputCls} /></div>
          </div>

          <div>
            <label className={labelCls}>Tu posicionamiento (la IA lo usa para evaluar ofertas)</label>
            <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </div>

          <div className="flex justify-between pt-1">
            <button onClick={() => setStep(0)} className="inline-flex items-center gap-1 text-sm text-gris-500 hover:text-negro">
              <Icon name="arrow_back" size={16} /> Volver
            </button>
            <button
              onClick={() => { if (!fullName.trim()) { setError('Falta tu nombre.'); return; } if (roles.length === 0) { setError('Agregá al menos un rol objetivo.'); return; } setError(null); setStep(2); }}
              className="inline-flex items-center gap-2 rounded-full bg-core px-5 py-2.5 text-sm font-semibold text-white hover:bg-core-500 active:scale-[0.97] transition"
            >
              Continuar <Icon name="arrow_forward" size={18} />
            </button>
          </div>
        </section>
      )}

      {/* Paso 3 — Activación */}
      {step === 2 && (
        <section className="rounded-3xl border border-hairline bg-white p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-negro">Todo listo, {fullName.split(' ')[0]}</h2>
            <p className="text-sm text-gris-500 mt-1">Al activar tu cuenta, el sistema empieza a trabajar para vos:</p>
          </div>
          <ul className="space-y-3">
            {[
              { icon: 'radar', text: <>Escaneo automático de portales (Computrabajo, Talent.com, LinkedIn…) buscando: <strong className="text-negro">{roles.join(', ')}</strong></> },
              { icon: 'fact_check', text: <>Cada oferta nueva se <strong className="text-negro">evalúa con IA contra tu perfil</strong> y recibe un score 1-5</> },
              { icon: 'description', text: <>CV adaptado y optimizado para ATS, listo para cada aplicación</> },
            ].map((it, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gris-700">
                <span className="w-8 h-8 rounded-full bg-tile flex items-center justify-center shrink-0">
                  <Icon name={it.icon} size={18} className="text-intel-700" />
                </span>
                <span className="pt-1.5">{it.text}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between pt-1">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm text-gris-500 hover:text-negro">
              <Icon name="arrow_back" size={16} /> Volver
            </button>
            <button
              onClick={activate}
              disabled={activating}
              className="inline-flex items-center gap-2 rounded-full bg-core px-6 py-2.5 text-sm font-semibold text-white hover:bg-core-500 active:scale-[0.97] transition disabled:bg-gris-300"
            >
              {activating ? 'Activando…' : 'Activar mi cuenta'} <Icon name="rocket_launch" size={18} />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
