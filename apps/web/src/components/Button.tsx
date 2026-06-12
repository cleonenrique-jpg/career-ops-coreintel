'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary: 'bg-core text-white hover:bg-core-500 disabled:bg-core/40',
  secondary: 'bg-intel text-white hover:bg-intel-700 disabled:bg-intel/40',
  ghost: 'bg-transparent text-intel-700 hover:bg-intel-50',
  danger: 'bg-estado-error text-white hover:bg-[#a93226]',
};

// Botón editorial (preset 2 · ci-btn): pill, core fill, active scale.
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', className = '', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${styles[variant]} ${className}`}
      {...rest}
    />
  );
});
