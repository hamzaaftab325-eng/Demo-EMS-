
-- Phase 5 stabilization: allow the trusted Super Admin correction workflow
-- to append correction events while direct client writes remain blocked by
-- the existing workflow-only trigger.
drop policy if exists attendance_events_insert_own on public.attendance_events;

create policy attendance_events_insert_own_or_super
on public.attendance_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workdays w
    where w.id = attendance_events.workday_id
      and (
        w.employee_id = (select private.current_profile_id())
        or (select private.is_super_admin())
      )
  )
);

revoke delete, update, truncate, references, trigger
on table public.attendance_events from authenticated;

notify pgrst, 'reload schema';
