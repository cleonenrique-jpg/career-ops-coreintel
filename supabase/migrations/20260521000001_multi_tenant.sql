-- Multi-tenant foundation: add role + status to profiles, auto-provision new users.

create type user_role as enum ('admin', 'member');
create type user_status as enum ('pending', 'active', 'suspended');

alter table profiles
  add column role user_role not null default 'member',
  add column status user_status not null default 'pending';

-- Promote the existing single-tenant user to admin/active.
-- Replace the email if your admin account uses a different one.
update profiles
set role = 'admin', status = 'active'
where email = 'carlos.leon@coreintelhub.com';

-- Auto-create a profiles row for every new auth.users insert (signup/invite).
-- SECURITY DEFINER so it bypasses RLS; runs as the owner of this function.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email, role, status)
  values (new.id, '', coalesce(new.email, ''), 'member', 'pending')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
