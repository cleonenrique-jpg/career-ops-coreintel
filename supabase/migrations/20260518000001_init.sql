-- career-ops-cloud — initial schema
-- Single-user activo, multi-tenant ready (todas las tablas con user_id + RLS).

-- ── Enums ──────────────────────────────────────────────────────────

create type application_status as enum (
  'Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP'
);

create type pipeline_url_status as enum (
  'pending', 'processed', 'discarded', 'expired'
);

create type liveness_result as enum ('active', 'expired', 'uncertain');

create type scan_source as enum (
  'greenhouse', 'ashby', 'lever', 'linkedin', 'computrabajo', 'talent', 'tecoloco', 'manual'
);

create type language_mode as enum ('en', 'es', 'de', 'fr', 'ja');

create type job_state as enum (
  'pending', 'in_progress', 'completed', 'failed', 'cancelled'
);

-- ── Tables ─────────────────────────────────────────────────────────

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  location text,
  timezone text,
  linkedin text,
  portfolio_url text,
  github text,
  archetypes jsonb not null default '[]'::jsonb,
  narrative text,
  superpowers jsonb not null default '[]'::jsonb,
  comp_target_min integer,
  comp_target_max integer,
  comp_currency text not null default 'USD',
  language_mode language_mode not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_md text not null,
  version integer not null default 1,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create index cvs_user_active_idx on cvs (user_id, is_active);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  num integer not null,
  date text not null,
  company text not null,
  role text not null,
  score numeric(2,1),
  status application_status not null default 'Evaluated',
  pdf_url text,
  url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index applications_user_num_unq on applications (user_id, num);
create index applications_user_status_idx on applications (user_id, status);

create table pipeline_urls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  company text,
  title text,
  status pipeline_url_status not null default 'pending',
  scanned_at timestamptz not null default now(),
  processed_at timestamptz,
  application_id uuid references applications(id) on delete set null,
  source scan_source
);
create unique index pipeline_user_url_unq on pipeline_urls (user_id, url);
create index pipeline_user_status_idx on pipeline_urls (user_id, status);

create table scan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  company text,
  title text,
  location text,
  source scan_source not null,
  first_seen_at timestamptz not null default now()
);
create unique index scan_history_user_url_unq on scan_history (user_id, url);

create table reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  num integer not null,
  content_md text not null,
  verification liveness_result not null default 'uncertain',
  generated_at timestamptz not null default now()
);
create index reports_app_idx on reports (application_id);

create table interview_prep (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  content_md text not null,
  generated_at timestamptz not null default now()
);

create table story_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  situation text,
  task text,
  action text,
  result text,
  reflection text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null,
  response_at timestamptz,
  channel text,
  notes text
);

create table portals_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source scan_source not null,
  company_slug text,
  company_name text,
  api_url text,
  careers_url text,
  queries jsonb not null default '[]'::jsonb,
  title_positive jsonb not null default '[]'::jsonb,
  title_negative jsonb not null default '[]'::jsonb,
  location_filter jsonb,
  enabled boolean not null default true
);
create index portals_user_source_idx on portals_config (user_id, source);

create table evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pipeline_url_id uuid references pipeline_urls(id) on delete set null,
  application_id uuid references applications(id) on delete set null,
  model text not null,
  prompt_version text not null,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10,6),
  success boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);
create index eval_runs_user_idx on evaluation_runs (user_id, created_at);

-- ── updated_at triggers ────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at before update on profiles
  for each row execute procedure set_updated_at();
create trigger applications_updated_at before update on applications
  for each row execute procedure set_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────
-- Single-tenant ready: policies use auth.uid() so the same code works
-- when signup opens. Service-role key bypasses RLS for backend workers.

alter table profiles        enable row level security;
alter table cvs             enable row level security;
alter table applications    enable row level security;
alter table pipeline_urls   enable row level security;
alter table scan_history    enable row level security;
alter table reports         enable row level security;
alter table interview_prep  enable row level security;
alter table story_bank      enable row level security;
alter table follow_ups      enable row level security;
alter table portals_config  enable row level security;
alter table evaluation_runs enable row level security;

-- Generic per-table user-isolation policies
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles', 'cvs', 'applications', 'pipeline_urls', 'scan_history',
      'reports', 'interview_prep', 'story_bank', 'follow_ups',
      'portals_config', 'evaluation_runs'
    ])
  loop
    execute format($f$
      create policy "%1$s_select_own" on %1$I
        for select using (user_id = auth.uid());
      create policy "%1$s_insert_own" on %1$I
        for insert with check (user_id = auth.uid());
      create policy "%1$s_update_own" on %1$I
        for update using (user_id = auth.uid()) with check (user_id = auth.uid());
      create policy "%1$s_delete_own" on %1$I
        for delete using (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;
