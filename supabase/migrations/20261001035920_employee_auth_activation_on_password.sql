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
      lower(p.email) ~ '^[^@[:space:]]+@emarketselect\.com$'
      or (
        p.is_test_account
        and lower(p.email) ~ '^[^@[:space:]]+@example\.test$'
      )
    )
    and (p.auth_user_id is null or p.auth_user_id = new.id)
  limit 1
  for update;

  if v_profile_id is null then
    return new;
  end if;

  update public.profiles p
     set auth_user_id = new.id,
         auth_invited_at = coalesce(p.auth_invited_at, new.invited_at),
         auth_activated_at = coalesce(
           p.auth_activated_at,
           case
             when coalesce(new.encrypted_password, '') <> ''
               and coalesce(new.email_confirmed_at, new.last_sign_in_at) is not null
               then coalesce(new.email_confirmed_at, new.last_sign_in_at, now())
             when new.invited_at is null
               then coalesce(new.email_confirmed_at, new.last_sign_in_at)
             else null
           end
         ),
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
    select
      v_profile_id,
      'account_activated',
      'profile',
      v_profile_id::text,
      jsonb_build_object('auth_activated_at', null),
      jsonb_build_object(
        'auth_activated_at', (
          select auth_activated_at
          from public.profiles
          where id = v_profile_id
        )
      ),
      'Employee completed account activation'
    where not exists (
      select 1
      from public.audit_logs al
      where al.action = 'account_activated'
        and al.entity_type = 'profile'
        and al.entity_id = v_profile_id::text
    );
  end if;

  return new;
end;
$$;

revoke all on function private.link_preprovisioned_profile()
from public, anon, authenticated;

drop trigger if exists ems_link_preprovisioned_profile on auth.users;

create trigger ems_link_preprovisioned_profile
after insert or update of
  email,
  last_sign_in_at,
  email_confirmed_at,
  invited_at,
  encrypted_password
on auth.users
for each row
execute function private.link_preprovisioned_profile();
