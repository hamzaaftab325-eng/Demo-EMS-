create or replace function private.validate_employee_access_contact_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1
    from public.profiles p
    where p.id <> new.employee_id
      and lower(p.email) = lower(new.personal_email)
  ) then
    raise exception 'Personal/setup email conflicts with another employee login.';
  end if;

  if exists (
    select 1
    from public.employee_access_contacts c
    where c.employee_id <> new.employee_id
      and c.work_email is not null
      and lower(c.work_email) = lower(new.personal_email)
  ) then
    raise exception 'Personal/setup email conflicts with another employee work email.';
  end if;

  if new.work_email is not null then
    if exists (
      select 1
      from public.profiles p
      where p.id <> new.employee_id
        and lower(p.email) = lower(new.work_email)
    ) then
      raise exception 'Work email conflicts with another employee login.';
    end if;

    if exists (
      select 1
      from public.employee_access_contacts c
      where c.employee_id <> new.employee_id
        and lower(c.personal_email) = lower(new.work_email)
    ) then
      raise exception 'Work email conflicts with another employee setup email.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_employee_access_contact_identity()
from public, anon, authenticated;

drop trigger if exists employee_access_contacts_identity_guard
on public.employee_access_contacts;

create trigger employee_access_contacts_identity_guard
before insert or update of personal_email, work_email, employee_id
on public.employee_access_contacts
for each row
execute function private.validate_employee_access_contact_identity();
