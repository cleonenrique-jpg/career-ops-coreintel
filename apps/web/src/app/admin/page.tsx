'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';

type UserRole = 'admin' | 'member';
type UserStatus = 'pending' | 'active' | 'suspended';

interface AdminUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<UserStatus, string> = {
  pending: 'bg-amarillo/20 text-[#7a5d00]',
  active: 'bg-core/10 text-core-700',
  suspended: 'bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<UserStatus, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
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
      const res = await api.get<{ users: AdminUser[]; me?: { userId: string } }>('/api/admin/users');
      setUsers(res.users);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // capture current user id from supabase session for self-action guard
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 text-intel-700">Administración</h1>
        <p className="text-text-muted">Gestioná invitaciones, roles y estado de los usuarios.</p>
      </header>

      <Card>
        <h2 className="text-h3 text-intel-700 mb-3">Invitar usuario</h2>
        <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-gris-500 mb-1">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="nombre@empresa.com"
              className="w-full rounded border border-gris-300 px-3 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gris-500 mb-1">Rol</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="rounded border border-gris-300 px-3 py-1.5 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={inviting || !inviteEmail}>
            {inviting ? 'Enviando…' : 'Enviar invitación'}
          </Button>
        </form>
        <p className="text-xs text-gris-500 mt-2">
          Recibirá un magic link por email. Al hacer click, su cuenta queda pendiente hasta que la apruebes.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-h3 text-intel-700">Usuarios ({users.length})</h2>
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? 'Cargando…' : 'Recargar'}
          </Button>
        </div>

        {error && <div className="text-sm text-red-700 mb-2">Error: {error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gris-500 border-b border-gris-200">
                <th className="py-2 pr-3 font-semibold">Email</th>
                <th className="py-2 pr-3 font-semibold">Nombre</th>
                <th className="py-2 pr-3 font-semibold">Rol</th>
                <th className="py-2 pr-3 font-semibold">Estado</th>
                <th className="py-2 pr-3 font-semibold">Creado</th>
                <th className="py-2 pr-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.userId === me;
                return (
                  <tr key={u.userId} className="border-b border-gris-100">
                    <td className="py-2 pr-3 font-medium text-intel-700">
                      {u.email}
                      {isSelf && <span className="ml-2 text-xs text-gris-500">(vos)</span>}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{u.fullName || '—'}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-block rounded px-2 py-0.5 text-xs bg-intel-50 text-intel-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_STYLES[u.status]}`}>
                        {STATUS_LABELS[u.status]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-text-muted whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {isSelf ? (
                        <span className="text-xs text-gris-500">—</span>
                      ) : (
                        <div className="inline-flex gap-1.5">
                          {u.status !== 'active' && (
                            <Button variant="primary" onClick={() => patchUser(u.userId, { status: 'active' })}>
                              Aprobar
                            </Button>
                          )}
                          {u.status !== 'suspended' && (
                            <Button variant="danger" onClick={() => patchUser(u.userId, { status: 'suspended' })}>
                              Suspender
                            </Button>
                          )}
                          {u.role === 'member' ? (
                            <Button variant="ghost" onClick={() => patchUser(u.userId, { role: 'admin' })}>
                              Hacer admin
                            </Button>
                          ) : (
                            <Button variant="ghost" onClick={() => patchUser(u.userId, { role: 'member' })}>
                              Quitar admin
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && !loading && (
                <tr><td colSpan={6} className="py-4 text-center text-text-muted">Sin usuarios.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
