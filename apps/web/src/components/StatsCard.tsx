import { HTMLAttributes } from 'react';
import { Icon } from './Icon';

interface Props extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: number | string;
  icon: string;
  accent: string;
  active?: boolean;
  onClick?: () => void;
}

// Stat tile editorial (preset 2): fondo tile plano, número grande en negro de
// marca y dot de categoría — el acento va como dato, no como borde/texto.
export function StatsCard({ label, value, icon, accent, active, onClick, className = '', ...rest }: Props) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`bg-tile rounded-3xl px-5 py-4 transition ${
        onClick ? 'cursor-pointer hover:bg-gris-100' : ''
      } ${active ? 'ring-2 ring-core/40' : ''} ${className}`}
      {...rest}
    >
      <div className="text-h2 font-semibold tracking-[-0.03em] text-negro tabular-nums">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-gris-500 mt-1 flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
        <Icon name={icon} size={15} className="text-gris-500" />
        {label}
      </div>
    </div>
  );
}
