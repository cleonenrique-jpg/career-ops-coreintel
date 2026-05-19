-- Add pdf_url to interview_prep (worker generates PDF alongside markdown).
alter table interview_prep
  add column if not exists pdf_url text;

-- New table: cv_tailored — tailored CV per application (JD-adapted).
create table if not exists cv_tailored (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  html_content text not null,
  pdf_url text,
  keyword_coverage numeric(4, 1),
  generated_at timestamptz not null default now()
);
create index if not exists cv_tailored_app_idx on cv_tailored (application_id);

alter table cv_tailored enable row level security;
create policy cv_tailored_owner on cv_tailored
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
