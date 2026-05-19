interface Props {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function FilterChip({ label, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs border transition ${
        active
          ? 'bg-core text-white border-core'
          : 'bg-white text-intel-700 border-gris-300 hover:bg-intel-50'
      }`}
    >
      {label}
    </button>
  );
}
