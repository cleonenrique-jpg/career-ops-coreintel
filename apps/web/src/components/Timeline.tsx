import type { ApplicationStatus } from '@career-ops/shared';
import { Icon } from './Icon';

export type StepState = 'done' | 'active' | 'pending' | 'rejected' | 'skipped';

export interface TimelineStep {
  label: string;
  state: StepState;
  meta?: string;
}

interface Props {
  steps: TimelineStep[];
  summary?: string;
  summaryTone?: 'neutral' | 'warn' | 'danger';
}

const dotStyles: Record<StepState, string> = {
  done:     'bg-lima border-lima text-white',
  active:   'bg-white border-amarillo ring-4 ring-amarillo/25',
  pending:  'bg-white border-gris-300',
  rejected: 'bg-red-500 border-red-500 text-white',
  skipped:  'bg-gris-300 border-gris-300 text-white',
};

const labelStyles: Record<StepState, string> = {
  done:     'text-[#5b6c00] font-medium',
  active:   'text-estado-warn font-semibold',
  pending:  'text-gris-500',
  rejected: 'text-red-600',
  skipped:  'text-gris-500 italic',
};

const connectorStyles: Record<StepState, string> = {
  done:     'bg-lima',
  active:   'bg-gris-300',
  pending:  'bg-gris-300',
  rejected: 'bg-red-500',
  skipped:  'bg-gris-300',
};

const summaryTone: Record<NonNullable<Props['summaryTone']>, string> = {
  neutral: 'text-gris-500',
  warn:    'text-estado-warn',
  danger:  'text-red-600',
};

function DotMark({ state }: { state: StepState }) {
  if (state === 'done')     return <Icon name="check" size={9} weight={700} />;
  if (state === 'rejected') return <Icon name="close" size={9} weight={700} />;
  if (state === 'skipped')  return <Icon name="remove" size={9} weight={700} />;
  return null;
}

export function Timeline({ steps, summary, summaryTone: tone = 'neutral' }: Props) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[220px]">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={s.label} className="flex items-start gap-2 relative py-0.5 text-[11px]">
            {!isLast && (
              <span
                className={`absolute left-[6px] top-[18px] bottom-[-4px] w-0.5 ${connectorStyles[s.state]}`}
              />
            )}
            <div
              className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10 flex items-center justify-center ${dotStyles[s.state]}`}
            >
              <DotMark state={s.state} />
            </div>
            <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
              <span className={labelStyles[s.state]}>{s.label}</span>
              {s.meta && <span className="text-[10px] text-gris-500 ml-auto whitespace-nowrap">{s.meta}</span>}
            </div>
          </div>
        );
      })}
      {summary && (
        <div className={`text-[10px] pt-1.5 mt-1 border-t border-dashed border-hairline ${summaryTone[tone]}`}>
          {summary}
        </div>
      )}
    </div>
  );
}

const STAGE_ORDER: ApplicationStatus[] = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer'];

export function buildTimeline(opts: {
  status: ApplicationStatus;
  date: string;
  updatedAt: string;
  score: number | null;
}): { steps: TimelineStep[]; summary: string; tone: 'neutral' | 'warn' | 'danger' } {
  const { status, date, updatedAt, score } = opts;
  const today = new Date();
  const applied = new Date(date);
  const updated = new Date(updatedAt);
  const daysFromApplied = Math.floor((today.getTime() - applied.getTime()) / 86400000);
  const daysFromUpdated = Math.floor((today.getTime() - updated.getTime()) / 86400000);

  function fmt(d: Date): string {
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
  }

  if (status === 'SKIP' || status === 'Discarded') {
    const steps: TimelineStep[] = [
      { label: 'No aplicada', state: 'skipped', meta: fmt(applied) },
      { label: 'Contactada', state: 'pending' },
      { label: 'Entrevista', state: 'pending' },
      { label: 'Esperando decisión', state: 'pending' },
    ];
    return {
      steps,
      summary: status === 'SKIP'
        ? (score && score < 3 ? 'Score bajo · no recomendado' : 'No aplicar')
        : 'Descartada',
      tone: score && score < 3 ? 'danger' : 'neutral',
    };
  }

  if (status === 'Rejected') {
    const steps: TimelineStep[] = [
      { label: 'Aplicada', state: 'done', meta: fmt(applied) },
      { label: 'Contactada', state: 'done', meta: fmt(updated) },
      { label: 'Entrevista', state: 'skipped', meta: 'sin avanzar' },
      { label: 'Rechazo', state: 'rejected', meta: `${fmt(updated)} · +${daysFromApplied}d` },
    ];
    return { steps, summary: `${daysFromApplied} días proceso · ¿lección aprendida?`, tone: 'neutral' };
  }

  const idx = STAGE_ORDER.indexOf(status);
  if (idx <= 0) {
    return {
      steps: [
        { label: 'Aplicada', state: 'pending', meta: 'sin aplicar' },
        { label: 'Contactada', state: 'pending' },
        { label: 'Entrevista', state: 'pending' },
        { label: 'Esperando decisión', state: 'pending' },
      ],
      summary: score && score >= 4
        ? 'Score alto, vale la pena aplicar'
        : score && score < 3
        ? 'Score bajo · no recomendado'
        : 'Pendiente de aplicar',
      tone: score && score < 3 ? 'danger' : 'neutral',
    };
  }

  const stages: TimelineStep[] = [
    {
      label: 'Aplicada',
      state: idx >= 1 ? 'done' : 'pending',
      meta: idx >= 1 ? `${fmt(applied)}${daysFromApplied > 0 ? ` · hace ${daysFromApplied}d` : ''}` : undefined,
    },
    {
      label: 'Contactada',
      state: idx >= 2 ? 'done' : 'pending',
      meta: idx >= 2 ? fmt(updated) : idx === 1 ? 'sin respuesta' : undefined,
    },
    {
      label: 'Entrevista',
      state: idx >= 3 ? (idx === 3 ? 'active' : 'done') : 'pending',
      meta: idx >= 3 ? fmt(updated) : undefined,
    },
    {
      label: idx === 4 ? 'Oferta' : 'Esperando decisión',
      state: idx >= 4 ? 'done' : 'pending',
      meta: idx >= 4 ? fmt(updated) : undefined,
    },
  ];

  const firstPending = stages.findIndex((s) => s.state === 'pending');
  if (firstPending > 0 && idx >= firstPending - 1) {
    stages[firstPending - 1]!.state = stages[firstPending - 1]!.state === 'done' ? 'done' : 'active';
  }

  let summary = `${daysFromApplied} días en proceso`;
  let tone: 'neutral' | 'warn' | 'danger' = 'neutral';
  if (status === 'Applied' && daysFromUpdated >= 4) {
    summary = `Follow-up sugerido${daysFromUpdated >= 7 ? ' (atrasado)' : ''}`;
    tone = daysFromUpdated >= 7 ? 'warn' : 'neutral';
  }
  if (status === 'Offer') summary = `${daysFromApplied} días proceso total`;
  if (status === 'Interview') summary = `${daysFromApplied} días · prep recomendado`;

  return { steps: stages, summary, tone };
}
