'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';

// Registra un 'app_open' por día y por navegador, para las métricas de
// retención (3 días) y uso semanal. No bloquea ni molesta al usuario.
export function UsageTracker() {
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const key = 'usage:lastPing';
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
      api.post('/api/events', { event: 'app_open', path: window.location.pathname }).catch(() => {});
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
