
-- Move privileged request implementations out of the exposed public API schema.
-- Public RPCs become SECURITY INVOKER wrappers; private implementations retain
-- the transaction/authorization logic and are not exposed by PostgREST.

alter function public.request_submit_leave(uuid,date,date,text)
  set schema private;
alter function private.request_submit_leave(uuid,date,date,text)
  rename to request_submit_leave_impl;

alter function public.request_submit_schedule_change(
  public.request_type,date,date,time,time,boolean,text
)
  set schema private;
alter function private.request_submit_schedule_change(
  public.request_type,date,date,time,time,boolean,text
)
  rename to request_submit_schedule_change_impl;

alter function public.request_cancel(uuid,text)
  set schema private;
alter function private.request_cancel(uuid,text)
  rename to request_cancel_impl;

alter function public.request_decide(uuid,public.approval_decision,text)
  set schema private;
alter function private.request_decide(uuid,public.approval_decision,text)
  rename to request_decide_impl;

alter function public.request_reassign_approver(uuid,uuid,text)
  set schema private;
alter function private.request_reassign_approver(uuid,uuid,text)
  rename to request_reassign_approver_impl;

create or replace function public.request_submit_leave(
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.request_submit_leave_impl(
    p_leave_type_id,
    p_start_date,
    p_end_date,
    p_reason
  )
$$;

create or replace function public.request_submit_schedule_change(
  p_request_type public.request_type,
  p_start_date date,
  p_end_date date,
  p_new_start_time time,
  p_new_end_time time,
  p_is_permanent boolean default false,
  p_reason text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.request_submit_schedule_change_impl(
    p_request_type,
    p_start_date,
    p_end_date,
    p_new_start_time,
    p_new_end_time,
    p_is_permanent,
    p_reason
  )
$$;

create or replace function public.request_cancel(
  p_request_id uuid,
  p_reason text default null
)
returns void
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.request_cancel_impl(p_request_id,p_reason)
$$;

create or replace function public.request_decide(
  p_request_id uuid,
  p_decision public.approval_decision,
  p_comment text default null
)
returns void
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.request_decide_impl(
    p_request_id,
    p_decision,
    p_comment
  )
$$;

create or replace function public.request_reassign_approver(
  p_request_id uuid,
  p_new_approver_id uuid,
  p_comment text default null
)
returns void
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.request_reassign_approver_impl(
    p_request_id,
    p_new_approver_id,
    p_comment
  )
$$;

grant usage on schema private to authenticated;

revoke all on function private.request_submit_leave_impl(uuid,date,date,text)
  from public, anon;
revoke all on function private.request_submit_schedule_change_impl(
  public.request_type,date,date,time,time,boolean,text
) from public, anon;
revoke all on function private.request_cancel_impl(uuid,text)
  from public, anon;
revoke all on function private.request_decide_impl(
  uuid,public.approval_decision,text
) from public, anon;
revoke all on function private.request_reassign_approver_impl(uuid,uuid,text)
  from public, anon;

grant execute on function private.request_submit_leave_impl(uuid,date,date,text)
  to authenticated;
grant execute on function private.request_submit_schedule_change_impl(
  public.request_type,date,date,time,time,boolean,text
) to authenticated;
grant execute on function private.request_cancel_impl(uuid,text)
  to authenticated;
grant execute on function private.request_decide_impl(
  uuid,public.approval_decision,text
) to authenticated;
grant execute on function private.request_reassign_approver_impl(uuid,uuid,text)
  to authenticated;

revoke all on function public.request_submit_leave(uuid,date,date,text)
  from public, anon;
revoke all on function public.request_submit_schedule_change(
  public.request_type,date,date,time,time,boolean,text
) from public, anon;
revoke all on function public.request_cancel(uuid,text)
  from public, anon;
revoke all on function public.request_decide(
  uuid,public.approval_decision,text
) from public, anon;
revoke all on function public.request_reassign_approver(uuid,uuid,text)
  from public, anon;

grant execute on function public.request_submit_leave(uuid,date,date,text)
  to authenticated;
grant execute on function public.request_submit_schedule_change(
  public.request_type,date,date,time,time,boolean,text
) to authenticated;
grant execute on function public.request_cancel(uuid,text)
  to authenticated;
grant execute on function public.request_decide(
  uuid,public.approval_decision,text
) to authenticated;
grant execute on function public.request_reassign_approver(uuid,uuid,text)
  to authenticated;

notify pgrst, 'reload schema';
