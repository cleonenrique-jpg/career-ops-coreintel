-- Feedback de clientes + eventos de uso (para métricas de adopción/retención).

-- ── Enums ────────────────────────────────────────────────────────────
create type feedback_type as enum ('error', 'sugerencia', 'funcion_faltante', 'comentario_general');
create type feedback_category as enum ('bug', 'ux', 'nueva_funcionalidad', 'rendimiento', 'contenido', 'monetizacion');
create type feedback_priority as enum ('baja', 'media', 'alta', 'critica');
create type feedback_status as enum ('nuevo', 'en_revision', 'planificado', 'en_progreso', 'resuelto', 'descartado');

-- ── Feedback ─────────────────────────────────────────────────────────
create table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  rating integer not null check (rating between 1 and 5),
  type feedback_type not null,
  description text not null,
  screenshot_path text,
  would_recommend boolean,
  -- Clasificación por el admin:
  category feedback_category,
  priority feedback_priority,
  status feedback_status not null default 'nuevo',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feedback_created_at_idx on feedback (created_at desc);
create index feedback_status_idx on feedback (status);
create index feedback_user_idx on feedback (user_id);

alter table feedback enable row level security;

-- El cliente solo ve/inserta lo suyo. El admin lee vía el rol postgres (API), que ignora RLS.
create policy "feedback insert own"
  on feedback for insert
  with check (user_id = auth.uid());
create policy "feedback select own"
  on feedback for select
  using (user_id = auth.uid());

-- ── Eventos de uso ───────────────────────────────────────────────────
create table usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,            -- p.ej. 'app_open', 'login'
  path text,
  created_at timestamptz not null default now()
);

create index usage_events_user_created_idx on usage_events (user_id, created_at desc);
create index usage_events_event_created_idx on usage_events (event, created_at desc);

alter table usage_events enable row level security;

create policy "usage insert own"
  on usage_events for insert
  with check (user_id = auth.uid());
create policy "usage select own"
  on usage_events for select
  using (user_id = auth.uid());
