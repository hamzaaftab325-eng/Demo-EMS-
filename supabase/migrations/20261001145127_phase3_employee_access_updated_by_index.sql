create index if not exists employee_access_contacts_updated_by_idx
on public.employee_access_contacts(updated_by)
where updated_by is not null;
