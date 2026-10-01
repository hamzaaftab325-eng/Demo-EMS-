
create or replace function private.link_preprovisioned_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_profile_id uuid;
  v_was_activated boolean := false;
  v_is_activated boolean := false;
  v_should_activate boolean := false;
begin
  if new.email is null then
    return new;
  end if;

  select p.id, (p.auth_activated_at is not null)
  into v_profile_id, v_was_activated
  from public.profiles p
  where lower(p.email) = lower(new.email)
    and p.is_active
    and p.employment_status <> 'deactivated'
    and (
      lower(p.email) ~ '^[^@[:space:]]+@emarketselect[.]com$'
      or (
        p.is_test_account
        and lower(p.email) ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      )
    )
    and (p.auth_user_id is null or p.auth_user_id = new.id)
  limit 1
  for update;

  if v_profile_id is null then
    return new;
  end if;

  -- An invite being opened/confirmed is not account activation.
  -- Activation occurs only when the user's password hash actually changes
  -- after confirmation, which is what updateUser({ password }) performs.
  if tg_op = 'UPDATE' then
    v_should_activate :=
      coalesce(new.encrypted_password, '') <> ''
      and new.encrypted_password is distinct from old.encrypted_password
      and coalesce(new.email_confirmed_at, new.last_sign_in_at) is not null;
  elsif tg_op = 'INSERT' and new.invited_at is null then
    -- Preserve support for directly provisioned non-invite users.
    v_should_activate :=
      coalesce(new.encrypted_password, '') <> ''
      and coalesce(new.email_confirmed_at, new.last_sign_in_at) is not null;
  end if;

  update public.profiles p
     set auth_user_id = new.id,
         auth_invited_at = coalesce(p.auth_invited_at, new.invited_at),
         auth_activated_at = case
           when p.auth_activated_at is not null then p.auth_activated_at
           when v_should_activate then coalesce(new.updated_at, now())
           else null
         end,
         last_login_at = coalesce(new.last_sign_in_at, p.last_login_at),
         updated_at = now()
   where p.id = v_profile_id
   returning p.auth_activated_at is not null
   into v_is_activated;

  if not v_was_activated and v_is_activated then
    insert into public.audit_logs(
      actor_id, action, entity_type, entity_id,
      before_data, after_data, reason
    )
    values (
      v_profile_id,
      'account_activated',
      'profile',
      v_profile_id::text,
      jsonb_build_object('auth_activated_at', null),
      jsonb_build_object(
        'auth_activated_at',
        (select auth_activated_at from public.profiles where id = v_profile_id)
      ),
      'Employee completed account activation by setting a password'
    );
  end if;

  return new;
end;
$$;

revoke all on function private.link_preprovisioned_profile()
from public, anon, authenticated;
