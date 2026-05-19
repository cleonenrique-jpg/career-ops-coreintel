import { HTMLAttributes } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-[var(--color-border)] bg-white shadow-sm p-5 ${className}`}
      {...rest}
    />
  );
}
