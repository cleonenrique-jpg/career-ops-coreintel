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

export function StatsCard({ label, value, icon, accent, active, onClick, className = '', ...rest }: Props) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`bg-white rounded-lg px-4 py-3 border-l-4 shadow-sm transition ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } ${active ? 'ring-2 ring-core/30' : ''} ${className}`}
      style={{ borderLeftColor: accent }}
      {...rest}
    >
      <div className="text-h3 font-bold text-intel-700">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gris-500 mt-0.5 flex items-center gap-1">
        <Icon name={icon} size={16} className="text-gris-500" />
        {label}
      </div>
    </div>
  );
}
