drop policy if exists profiles_select_own_auth_identity on public.profiles;
drop policy if exists profiles_select_scope on public.profiles;

create policy profiles_select_scope
on public.profiles
for select
to authenticated
using (
  (
    auth_user_id is not null
    and auth_user_id = (select auth.uid())
  )
  or
  (select private.can_access_employee(profiles.id))
);
