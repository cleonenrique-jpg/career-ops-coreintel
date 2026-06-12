import { HTMLAttributes } from 'react';

// Tile editorial (preset 2): plano, hairline, radio 24px — sin sombra.
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-3xl border border-hairline bg-white p-6 ${className}`}
      {...rest}
    />
  );
}
