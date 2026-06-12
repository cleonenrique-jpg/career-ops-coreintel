import { Icon } from './Icon';

interface Props {
  label: string;
  icon?: string;
  active?: boolean;
  onClick?: () => void;
}

export function FilterChip({ label, icon, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs border transition flex items-center gap-1.5 ${
        active
          ? 'bg-core text-white border-core'
          : 'bg-white text-intel-700 border-hairline hover:bg-intel-50'
      }`}
    >
      {icon && <Icon name={icon} size={14} />}
      {label}
    </button>
  );
}
