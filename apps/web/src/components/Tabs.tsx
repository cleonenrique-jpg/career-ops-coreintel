'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';

export interface TabDef {
  key: string;
  label: string;
  icon?: string;
}

interface Props {
  tabs: TabDef[];
  defaultTab?: string;
  children: (active: string) => ReactNode;
}

export function Tabs({ tabs, defaultTab, children }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get('tab') ?? defaultTab ?? tabs[0]!.key;
  const [active, setActive] = useState(initial);

  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (fromUrl && fromUrl !== active) setActive(fromUrl);
  }, [searchParams, active]);

  function select(key: string) {
    setActive(key);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-gris-300">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => select(t.key)}
            className={`px-4 py-2 text-sm border-b-2 transition -mb-px ${
              active === t.key
                ? 'border-core text-intel-700 font-semibold'
                : 'border-transparent text-gris-500 hover:text-intel-700'
            }`}
          >
            {t.icon && <span className="mr-1.5">{t.icon}</span>}
            {t.label}
          </button>
        ))}
      </div>
      <div>{children(active)}</div>
    </div>
  );
}
