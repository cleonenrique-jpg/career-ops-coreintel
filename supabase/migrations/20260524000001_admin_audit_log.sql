-- Admin audit log: tracks every privileged action performed by admins
-- (invites, approvals, suspensions, role changes) for traceability.

create type admin_action as enum ('invite', 'approve', 'suspend', 'reactivate', 'role_change');

create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_email text not null,
  action admin_action not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_at_idx on admin_audit_log (created_at desc);
create index admin_audit_log_actor_idx on admin_audit_log (actor_id);
