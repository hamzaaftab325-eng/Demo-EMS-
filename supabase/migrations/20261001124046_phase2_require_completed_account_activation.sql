create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
    and p.is_active
    and p.employment_status <> 'deactivated'
    and p.auth_activated_at is not null
  limit 1
$$;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.role
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
    and p.is_active
    and p.employment_status <> 'deactivated'
    and p.auth_activated_at is not null
  limit 1
$$;

drop policy if exists profiles_select_own_auth_identity on public.profiles;

create policy profiles_select_own_auth_identity
on public.profiles
for select
to authenticated
using (
  auth_user_id is not null
  and auth_user_id = (select auth.uid())
);

revoke all on function private.current_profile_id() from public, anon, authenticated;
revoke all on function private.current_app_role() from public, anon, authenticated;
