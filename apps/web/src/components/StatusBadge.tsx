import type { ApplicationStatus } from '@career-ops/shared';

const tone: Record<ApplicationStatus, string> = {
  Evaluated: 'bg-cyan/15 text-cyan',
  Applied:   'bg-core/15 text-core-700',
  Responded: 'bg-amarillo/20 text-[#7a5d00]',
  Interview: 'bg-lima/20 text-[#5b6c00]',
  Offer:     'bg-intel/15 text-intel-700',
  Rejected:  'bg-red-100 text-red-700',
  Discarded: 'bg-gris-100 text-gris-700',
  SKIP:      'bg-gris-100 text-gris-500',
};

export const STATUS_LABEL_ES: Record<ApplicationStatus, string> = {
  Evaluated: 'Pendiente',
  Applied:   'Aplicada',
  Responded: 'Contactada',
  Interview: 'Entrevista',
  Offer:     '¡Oferta!',
  Rejected:  'Rechazada',
  Discarded: 'Descartada',
  SKIP:      'Mal match',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${tone[status]}`}>
      {STATUS_LABEL_ES[status]}
    </span>
  );
}
