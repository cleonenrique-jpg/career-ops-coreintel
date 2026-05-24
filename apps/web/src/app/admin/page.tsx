'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type UserRole = 'admin' | 'member';
type UserStatus = 'pending' | 'active' | 'suspended';
type AdminAction = 'invite' | 'approve' | 'suspend' | 'reactivate' | 'role_change';

interface AdminUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

interface AuditEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: AdminAction;
  targetUserId: string | null;
  targetEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const STATUS_PILL: Record<UserStatus, { bg: string; text: string; label: string }> = {
  pending:   { bg: 'bg-[#FBF3DB]', text: 'text-[#7a5d00]', label: 'Pendiente' },
  active:    { bg: 'bg-[#EDF3EC]', text: 'text-[#346538]', label: 'Activo' },
  suspended: { bg: 'bg-[#FDEBEC]', text: 'text-[#9F2F2D]', label: 'Suspendido' },
};

const ACTION_PILL: Record<AdminAction, { bg: string; text: string; label: string }> = {
  invite:      { bg: 'bg-[#E1F3FE]', text: 'text-[#1F6C9F]', label: 'Invitar' },
  approve:     { bg: 'bg-[#EDF3EC]', text: 'text-[#346538]', label: 'Aprobar' },
  suspend:     { bg: 'bg-[#FDEBEC]', text: 'text-[#9F2F2D]', label: 'Suspender' },
  reactivate:  { bg: 'bg-[#FBF3DB]', text: 'text-[#7a5d00]', label: 'Reactivar' },
  role_change: { bg: 'bg-core/10',   text: 'text-core-700',  label: 'Rol' },
};

function describeMeta(action: AdminAction, meta: Record<string, unknown>): string {
  if (action === 'role_change' && meta.from_role && meta.to_role) return `${meta.from_role} → ${meta.to_role}`;
  if ((action === 'approve' || action === 'suspend' || action === 'reactivate') && meta.from_status && meta.to_status) {
    return `${meta.from_status} → ${meta.to_status}`;
  }
  if (action === 'invite' && meta.role) return `rol: ${meta.role}`;
  return '';
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('member');
  const [inviting, setInviting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, auditRes] = await Promise.all([
        api.get<{ users: AdminUser[] }>('/api/admin/users'),
        api.get<{ entries: AuditEntry[] }>('/api/admin/audit-log?limit=50'),
      ]);
      setUsers(usersRes.users);
      setAudit(auditRes.entries);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { createBrowserClient } = await import('@supabase/ssr');
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await sb.auth.getUser();
      setMe(data.user?.id ?? null);
    })();
    load();
  }, []);

  async function patchUser(userId: string, patch: Partial<Pick<AdminUser, 'role' | 'status'>>) {
    try {
      await api.patch(`/api/admin/users/${userId}`, patch);
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await api.post('/api/admin/users/invite', { email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      setInviteRole('member');
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setInviting(false);
    }
  }

  const counts = {
    total: users.length,
    pending: users.filter((u) => u.status === 'pending').length,
    active: users.filter((u) => u.status === 'active').length,
    admins: users.filter((u) => u.role === 'admin').length,
  };

  return (
    <div className="editorial-font min-h-screen bg-[#FBFBFA] -mx-6 -my-8 px-6 py-12 md:px-12 md:py-16">
      <div className="max-w-6xl mx-auto space-y-16">

        {/* Header — editorial */}
        <header className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
            Coreintel · Career Ops
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-intel-700 tracking-[-0.02em] leading-[1.05]">
            Administración
          </h1>
          <p className="text-base text-gris-500 max-w-xl leading-relaxed">
            Invita usuarios, gestiona roles y revisa el historial de acciones del sistema.
          </p>
        </header>

        {/* Stat strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#EAEAEA] border border-[#EAEAEA] rounded-xl overflow-hidden">
          {[
            { label: 'Total', value: counts.total },
            { label: 'Activos', value: counts.active },
            { label: 'Pendientes', value: counts.pending },
            { label: 'Admins', value: counts.admins },
          ].map((s) => (
            <div key={s.label} className="bg-white px-6 py-5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gris-500 font-medium mb-1">
                {s.label}
              </div>
              <div className="text-3xl font-bold text-intel-700 tabular-nums">
                {loading ? '—' : s.value}
              </div>
            </div>
          ))}
        </section>

        {/* Invite */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
              Invitar usuario
            </h2>
            <span className="text-xs text-gris-500">Magic link vía Resend</span>
          </div>
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-8">
            <form onSubmit={invite} className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[260px]">
                <label className="block text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="nombre@empresa.com"
                  className="w-full border-0 border-b border-[#EAEAEA] bg-transparent px-0 py-2 text-base text-intel-700 placeholder:text-gris-300 focus:outline-none focus:border-intel-700 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium mb-2">
                  Rol
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="border border-[#EAEAEA] rounded-md bg-white px-3 py-2 text-sm text-intel-700 focus:outline-none focus:border-intel-700"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting || !inviteEmail}
                className="px-5 py-2 text-sm font-semibold rounded-md bg-intel-700 text-white hover:bg-intel-700/90 active:scale-[0.98] transition disabled:bg-gris-300 disabled:cursor-not-allowed"
              >
                {inviting ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </form>
          </div>
        </section>

        {/* Users */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
              Usuarios <span className="text-gris-300">·</span> {users.length}
            </h2>
            <button
              onClick={load}
              disabled={loading}
              className="text-xs text-gris-500 hover:text-intel-700 transition disabled:opacity-50"
            >
              {loading ? 'Cargando…' : 'Recargar'}
            </button>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-[#FDEBEC] border border-[#FDEBEC] rounded-lg text-sm text-[#9F2F2D]">
              {error}
            </div>
          )}

          <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EAEAEA]">
                  <th className="text-left px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Email</th>
                  <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Rol</th>
                  <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Estado</th>
                  <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Creado</th>
                  <th className="text-right px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => {
                  const isSelf = u.userId === me;
                  const pill = STATUS_PILL[u.status];
                  return (
                    <tr key={u.userId} className={`${idx !== users.length - 1 ? 'border-b border-[#F3F3F1]' : ''} hover:bg-[#FBFBFA] transition-colors`}>
                      <td className="px-6 py-5 text-intel-700 font-medium">
                        <div className="flex items-center gap-2">
                          {u.email}
                          {isSelf && <span className="text-[10px] uppercase tracking-[0.12em] text-gris-500 font-medium">Vos</span>}
                        </div>
                        {u.fullName && <div className="text-xs text-gris-500 mt-0.5">{u.fullName}</div>}
                      </td>
                      <td className="px-3 py-5">
                        <span className="text-xs text-intel-700 capitalize">{u.role}</span>
                      </td>
                      <td className="px-3 py-5">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] font-semibold ${pill.bg} ${pill.text}`}>
                          {pill.label}
                        </span>
                      </td>
                      <td className="px-3 py-5 text-xs text-gris-500 whitespace-nowrap font-mono">
                        {new Date(u.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-5 text-right whitespace-nowrap">
                        {isSelf ? (
                          <span className="text-xs text-gris-300">—</span>
                        ) : (
                          <div className="inline-flex gap-1.5">
                            {u.status !== 'active' && (
                              <button onClick={() => patchUser(u.userId, { status: 'active' })}
                                className="px-3 py-1.5 text-xs font-medium rounded border border-[#EAEAEA] text-intel-700 hover:bg-[#EDF3EC] hover:border-[#EDF3EC] hover:text-[#346538] active:scale-[0.98] transition">
                                Aprobar
                              </button>
                            )}
                            {u.status !== 'suspended' && (
                              <button onClick={() => patchUser(u.userId, { status: 'suspended' })}
                                className="px-3 py-1.5 text-xs font-medium rounded border border-[#EAEAEA] text-intel-700 hover:bg-[#FDEBEC] hover:border-[#FDEBEC] hover:text-[#9F2F2D] active:scale-[0.98] transition">
                                Suspender
                              </button>
                            )}
                            <button onClick={() => patchUser(u.userId, { role: u.role === 'member' ? 'admin' : 'member' })}
                              className="px-3 py-1.5 text-xs font-medium rounded border border-[#EAEAEA] text-gris-500 hover:bg-white hover:text-intel-700 active:scale-[0.98] transition">
                              {u.role === 'member' ? 'Hacer admin' : 'Quitar admin'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && !loading && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gris-500 text-sm">Sin usuarios.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Audit log */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium">
              Audit log <span className="text-gris-300">·</span> {audit.length}
            </h2>
            <span className="text-xs text-gris-500">Últimas 50 acciones</span>
          </div>

          <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EAEAEA]">
                  <th className="text-left px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Cuándo</th>
                  <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Acción</th>
                  <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Admin</th>
                  <th className="text-left px-3 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Target</th>
                  <th className="text-left px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e, idx) => {
                  const pill = ACTION_PILL[e.action];
                  return (
                    <tr key={e.id} className={`${idx !== audit.length - 1 ? 'border-b border-[#F3F3F1]' : ''} hover:bg-[#FBFBFA] transition-colors`}>
                      <td className="px-6 py-4 text-xs text-gris-500 whitespace-nowrap font-mono">
                        {new Date(e.createdAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] font-semibold ${pill.bg} ${pill.text}`}>
                          {pill.label}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-sm text-intel-700">{e.actorEmail}</td>
                      <td className="px-3 py-4 text-sm text-gris-500">{e.targetEmail ?? '—'}</td>
                      <td className="px-6 py-4 text-xs text-gris-500 font-mono">{describeMeta(e.action, e.metadata) || '—'}</td>
                    </tr>
                  );
                })}
                {audit.length === 0 && !loading && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gris-500 text-sm">Sin acciones registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
