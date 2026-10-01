alter table public.profiles
  add column if not exists auth_invited_at timestamptz,
  add column if not exists auth_activated_at timestamptz;

update public.profiles p
set
  auth_invited_at = coalesce(p.auth_invited_at, u.invited_at),
  auth_activated_at = coalesce(
    p.auth_activated_at,
    case
      when u.invited_at is null
        then coalesce(u.email_confirmed_at, u.last_sign_in_at)
      else null
    end
  ),
  updated_at = now()
from auth.users u
where u.id = p.auth_user_id;

create or replace function private.link_preprovisioned_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if new.email is null then
    return new;
  end if;

  update public.profiles
     set auth_user_id = new.id,
         auth_invited_at = coalesce(auth_invited_at, new.invited_at),
         auth_activated_at = coalesce(
           auth_activated_at,
           case
             when new.invited_at is null
               then coalesce(new.email_confirmed_at, new.last_sign_in_at)
             else null
           end
         ),
         last_login_at = coalesce(new.last_sign_in_at, last_login_at),
         updated_at = now()
   where lower(email) = lower(new.email)
     and is_active
     and employment_status <> 'deactivated'
     and (
       lower(email) ~ '^[^@[:space:]]+@emarketselect\\.com$'
       or (
         is_test_account
         and lower(email) ~ '^[^@[:space:]]+@example\\.test$'
       )
     )
     and (auth_user_id is null or auth_user_id = new.id);

  return new;
end;
$$;

revoke all on function private.link_preprovisioned_profile()
from public, anon, authenticated;

drop trigger if exists ems_link_preprovisioned_profile on auth.users;
create trigger ems_link_preprovisioned_profile
after insert or update of email, last_sign_in_at, email_confirmed_at, invited_at
on auth.users
for each row
execute function private.link_preprovisioned_profile();

comment on column public.profiles.auth_invited_at is
  'Last time an EMS account setup invitation/recovery link was issued.';

comment on column public.profiles.auth_activated_at is
  'Time the employee completed password setup/activation for EMS login.';
