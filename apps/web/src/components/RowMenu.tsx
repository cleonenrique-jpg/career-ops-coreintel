'use client';

import { useEffect, useRef, useState } from 'react';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@career-ops/shared';
import { Icon } from './Icon';

interface Props {
  currentStatus: ApplicationStatus;
  onChangeStatus: (s: ApplicationStatus) => void;
  onCopyUrl?: () => void;
  onDelete?: () => void;
}

const STATUS_ICONS: Record<ApplicationStatus, string> = {
  Evaluated: 'inbox',
  Applied:   'send',
  Responded: 'forum',
  Interview: 'mic',
  Offer:     'redeem',
  Rejected:  'block',
  Discarded: 'archive',
  SKIP:      'do_not_disturb_on',
};

export function RowMenu({ currentStatus, onChangeStatus, onCopyUrl, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setSubOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-1.5 py-1 rounded text-gris-500 hover:bg-intel-50 hover:text-intel-700"
        aria-label="Más acciones"
      >
        <Icon name="more_vert" size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-hairline rounded-2xl shadow-lg min-w-[210px] z-50 py-1.5">
          <div
            className="relative"
            onMouseEnter={() => setSubOpen(true)}
            onMouseLeave={() => setSubOpen(false)}
          >
            <button className="w-full text-left px-3 py-2 text-xs text-intel-700 hover:bg-intel-50 flex items-center justify-between rounded">
              <span className="flex items-center gap-2"><Icon name="tune" size={14} /> Cambiar estado</span>
              <Icon name="chevron_right" size={14} className="text-gris-500" />
            </button>
            {subOpen && (
              <div className="absolute right-full top-0 mr-1 bg-white border border-hairline rounded-2xl shadow-lg min-w-[200px] py-1.5">
                {APPLICATION_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { onChangeStatus(s); setOpen(false); setSubOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-intel-50 ${
                      s === currentStatus ? 'bg-intel-50 text-intel-700 font-semibold' : 'text-intel-700'
                    }`}
                  >
                    <span className="w-3 text-estado-ok">
                      {s === currentStatus && <Icon name="check" size={12} weight={700} />}
                    </span>
                    <Icon name={STATUS_ICONS[s]} size={14} />
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {onCopyUrl && (
            <button
              onClick={() => { onCopyUrl(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-intel-700 hover:bg-intel-50 rounded flex items-center gap-2"
            >
              <Icon name="content_copy" size={14} /> Copiar URL
            </button>
          )}
          {onDelete && (
            <>
              <div className="h-px bg-gris-300 my-1" />
              <button
                onClick={() => { onDelete(); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded flex items-center gap-2"
              >
                <Icon name="delete" size={14} /> Eliminar fila
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
