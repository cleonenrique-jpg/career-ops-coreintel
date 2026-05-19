interface Props {
  name: string;
  size?: number;
  fill?: boolean;
  weight?: 300 | 400 | 500 | 600 | 700;
  className?: string;
}

export function Icon({ name, size = 18, fill = false, weight = 400, className = '' }: Props) {
  return (
    <span
      className={`material-symbols-rounded inline-block align-middle leading-none select-none ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${Math.max(20, Math.min(48, size))}`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
