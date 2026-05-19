'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface SectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Section({ id, title, subtitle, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-3 text-left group"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-h3 text-intel-700 group-hover:underline decoration-1 underline-offset-4">{title}</h2>
          {subtitle && <p className="text-sm text-gris-500">{subtitle}</p>}
        </div>
        <Icon
          name="expand_more"
          size={24}
          className={`text-intel-700 flex-shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </section>
  );
}
