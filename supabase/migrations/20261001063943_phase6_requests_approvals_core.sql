
-- Phase 6: Requests & Approvals.
-- Sensitive request transitions are performed by authenticated RPCs.

alter table public.requests
  add column if not exists cancellation_reason text;

alter table public.schedule_change_details
  add column if not exists applied_schedule_id uuid
    references public.work_schedules(id) on delete restrict,
  add column if not exists applied_at timestamptz;

create index if not exists schedule_change_details_applied_schedule_idx
  on public.schedule_change_details(applied_schedule_id)
  where applied_schedule_id is not null;

create or replace function private.request_active_manager_id(
  p_employee_id uuid,
  p_on_date date default current_date
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select rl.manager_id
  from public.reporting_lines rl
  join public.profiles m on m.id = rl.manager_id
  where rl.employee_id = p_employee_id
    and rl.is_primary
    and rl.effective_from <= p_on_date
    and (rl.effective_to is null or rl.effective_to >= p_on_date)
    and m.is_active
    and m.employment_status <> 'deactivated'
  order by rl.effective_from desc, rl.created_at desc
  limit 1
$$;

create or replace function private.request_final_approver_id(
  p_employee_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select sa.id
  from public.profiles sa
  join public.profiles employee on employee.id = p_employee_id
  where sa.role = 'super_admin'
    and sa.is_active
    and sa.employment_status <> 'deactivated'
    and sa.is_test_account = employee.is_test_account
    and sa.id <> employee.id
  order by sa.employee_code
  limit 1
$$;

create or replace function private.request_working_days(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns numeric
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with employee as (
    select department_id
    from public.profiles
    where id = p_employee_id
  ),
  days as (
    select d::date as work_date
    from generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      interval '1 day'
    ) d
  )
  select count(*)::numeric
  from days
  cross join employee e
  where extract(isodow from work_date) < 6
    and not exists (
      select 1
      from public.holidays h
      where h.holiday_date = work_date
        and (h.is_company_wide or h.department_id = e.department_id)
    )
$$;

create or replace function private.request_notify(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_request_id uuid
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  insert into public.notifications(
    recipient_id,
    type,
    title,
    message,
    entity_type,
    entity_id
  )
  values (
    p_recipient_id,
    p_type,
    p_title,
    p_message,
    'request',
    p_request_id
  );
end;
$$;

create or replace function private.request_create_fixed_schedule(
  p_request_id uuid,
  p_actor uuid
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_request public.requests%rowtype;
  v_detail public.schedule_change_details%rowtype;
  v_profile public.profiles%rowtype;
  v_schedule_id uuid;
  v_minutes integer;
  v_start_minutes integer;
  v_end_minutes integer;
  v_grace integer;
begin
  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  select * into v_detail
  from public.schedule_change_details
  where request_id = p_request_id
  for update;

  if not found then
    raise exception 'Schedule-change details are missing.';
  end if;

  if v_detail.applied_at is not null and v_detail.applied_schedule_id is not null then
    return v_detail.applied_schedule_id;
  end if;

  select * into v_profile
  from public.profiles
  where id = v_request.employee_id;

  if not found then
    raise exception 'Employee profile is missing.';
  end if;

  v_start_minutes :=
    extract(hour from v_detail.new_start_time)::integer * 60
    + extract(minute from v_detail.new_start_time)::integer;
  v_end_minutes :=
    extract(hour from v_detail.new_end_time)::integer * 60
    + extract(minute from v_detail.new_end_time)::integer;

  v_minutes := v_end_minutes - v_start_minutes;
  if v_minutes <= 0 then
    v_minutes := v_minutes + 1440;
  end if;

  if v_minutes < 60 or v_minutes > 960 then
    raise exception 'Requested work hours must span between 1 and 16 hours.';
  end if;

  select grace_period_minutes
  into v_grace
  from public.company_settings
  where id = 1;

  insert into public.work_schedules(
    name,
    schedule_type,
    daily_target_minutes,
    start_time,
    end_time,
    grace_minutes,
    timezone,
    is_active
  )
  values (
    format(
      'Request #%s · %s–%s',
      v_request.request_number,
      to_char(v_detail.new_start_time, 'HH24:MI'),
      to_char(v_detail.new_end_time, 'HH24:MI')
    ),
    'fixed',
    v_minutes,
    v_detail.new_start_time,
    v_detail.new_end_time,
    coalesce(v_grace, 15),
    v_profile.timezone,
    false
  )
  returning id into v_schedule_id;

  update public.schedule_change_details
  set applied_schedule_id = v_schedule_id
  where request_id = p_request_id;

  return v_schedule_id;
end;
$$;

create or replace function private.request_apply_schedule_change(
  p_request_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_request public.requests%rowtype;
  v_detail public.schedule_change_details%rowtype;
  v_cover public.schedule_assignments%rowtype;
  v_schedule_id uuid;
  v_restore_from date;
begin
  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  select * into v_detail
  from public.schedule_change_details
  where request_id = p_request_id
  for update;

  if v_detail.applied_at is not null then
    return;
  end if;

  v_schedule_id := private.request_create_fixed_schedule(p_request_id, p_actor);

  if v_detail.is_permanent then
    if exists (
      select 1
      from public.schedule_assignments sa
      where sa.employee_id = v_request.employee_id
        and sa.effective_from > v_request.start_date
    ) then
      raise exception
        'A future schedule assignment already exists. Resolve it before approving this permanent change.';
    end if;

    select * into v_cover
    from public.schedule_assignments sa
    where sa.employee_id = v_request.employee_id
      and sa.effective_from <= v_request.start_date
      and (sa.effective_to is null or sa.effective_to >= v_request.start_date)
    order by sa.effective_from desc, sa.created_at desc
    limit 1
    for update;

    if v_cover.id is not null then
      if v_cover.effective_from < v_request.start_date then
        update public.schedule_assignments
        set effective_to = v_request.start_date - 1
        where id = v_cover.id;
      else
        delete from public.schedule_assignments
        where id = v_cover.id;
      end if;
    end if;

    insert into public.schedule_assignments(
      employee_id,
      schedule_id,
      effective_from,
      effective_to,
      assigned_by
    )
    values (
      v_request.employee_id,
      v_schedule_id,
      v_request.start_date,
      null,
      p_actor
    );
  else
    select * into v_cover
    from public.schedule_assignments sa
    where sa.employee_id = v_request.employee_id
      and sa.effective_from <= v_request.start_date
      and (sa.effective_to is null or sa.effective_to >= v_request.end_date)
    order by sa.effective_from desc, sa.created_at desc
    limit 1
    for update;

    if v_cover.id is null then
      raise exception
        'The requested dates are not covered by one current schedule assignment.';
    end if;

    if exists (
      select 1
      from public.schedule_assignments sa
      where sa.employee_id = v_request.employee_id
        and sa.id <> v_cover.id
        and sa.effective_from <= v_request.end_date
        and (sa.effective_to is null or sa.effective_to >= v_request.start_date)
    ) then
      raise exception
        'The requested dates overlap another schedule assignment.';
    end if;

    if v_cover.effective_from < v_request.start_date then
      update public.schedule_assignments
      set effective_to = v_request.start_date - 1
      where id = v_cover.id;
    else
      delete from public.schedule_assignments
      where id = v_cover.id;
    end if;

    insert into public.schedule_assignments(
      employee_id,
      schedule_id,
      effective_from,
      effective_to,
      assigned_by
    )
    values (
      v_request.employee_id,
      v_schedule_id,
      v_request.start_date,
      v_request.end_date,
      p_actor
    );

    v_restore_from := v_request.end_date + 1;

    if v_cover.effective_to is null or v_cover.effective_to >= v_restore_from then
      insert into public.schedule_assignments(
        employee_id,
        schedule_id,
        effective_from,
        effective_to,
        assigned_by
      )
      values (
        v_request.employee_id,
        v_cover.schedule_id,
        v_restore_from,
        v_cover.effective_to,
        p_actor
      );
    end if;
  end if;

  update public.schedule_change_details
  set applied_at = now()
  where request_id = p_request_id;
end;
$$;

create or replace function private.request_apply_approved(
  p_request_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_request public.requests%rowtype;
  v_leave public.leave_request_details%rowtype;
begin
  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if v_request.status = 'approved' then
    return;
  end if;

  if v_request.status not in ('pending_manager', 'pending_final') then
    raise exception 'Request is no longer awaiting approval.';
  end if;

  if v_request.request_type = 'leave' then
    select * into v_leave
    from public.leave_request_details
    where request_id = p_request_id;

    if not found then
      raise exception 'Leave details are missing.';
    end if;

    insert into public.leave_ledger(
      employee_id,
      leave_type_id,
      transaction_type,
      days,
      request_id,
      effective_date,
      note,
      created_by
    )
    select
      v_request.employee_id,
      v_leave.leave_type_id,
      'approved_leave',
      -v_leave.days_requested,
      v_request.id,
      v_request.start_date,
      format('Approved request #%s', v_request.request_number),
      p_actor
    where not exists (
      select 1
      from public.leave_ledger ll
      where ll.request_id = v_request.id
        and ll.transaction_type = 'approved_leave'
    );
  else
    perform private.request_apply_schedule_change(p_request_id, p_actor);
  end if;

  update public.requests
  set
    status = 'approved',
    current_stage = null,
    completed_at = now()
  where id = p_request_id;

  perform private.request_notify(
    v_request.employee_id,
    'request_approved',
    format('Request #%s approved', v_request.request_number),
    'Your request has completed the approval process.',
    v_request.id
  );

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason
  )
  values (
    p_actor,
    'request_approved',
    'request',
    v_request.id::text,
    jsonb_build_object(
      'request_number', v_request.request_number,
      'request_type', v_request.request_type,
      'status', 'approved'
    ),
    'Request completed through EMS approval workflow'
  );
end;
$$;

create or replace function public.request_submit_leave(
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid;
  v_actor_profile public.profiles%rowtype;
  v_manager uuid;
  v_request_id uuid;
  v_days numeric;
  v_today date;
  v_leave_type public.leave_types%rowtype;
begin
  v_actor := private.current_profile_id();

  if v_actor is null then
    raise exception 'Active EMS profile required.';
  end if;

  select * into v_actor_profile
  from public.profiles
  where id = v_actor
  for share;

  v_today := (now() at time zone v_actor_profile.timezone)::date;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Enter a valid request date range.';
  end if;

  if p_start_date < v_today then
    raise exception 'Leave cannot start in the past.';
  end if;

  select * into v_leave_type
  from public.leave_types
  where id = p_leave_type_id
    and is_active;

  if not found then
    raise exception 'Select an active leave type.';
  end if;

  if v_leave_type.requires_reason
     and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for this leave type.';
  end if;

  v_days := private.request_working_days(v_actor, p_start_date, p_end_date);

  if v_days <= 0 then
    raise exception 'The selected range contains no working days.';
  end if;

  if exists (
    select 1
    from public.requests r
    where r.employee_id = v_actor
      and r.request_type = 'leave'
      and r.status in ('pending_manager', 'pending_final', 'approved')
      and r.start_date <= p_end_date
      and r.end_date >= p_start_date
  ) then
    raise exception 'This leave overlaps another active leave request.';
  end if;

  v_manager := private.request_active_manager_id(v_actor, v_today);

  if v_manager is null then
    raise exception 'No active approver is configured for your profile.';
  end if;

  if v_manager = v_actor then
    raise exception 'Self-approval is not allowed.';
  end if;

  insert into public.requests(
    employee_id,
    request_type,
    start_date,
    end_date,
    reason,
    status,
    current_stage,
    submitted_at
  )
  values (
    v_actor,
    'leave',
    p_start_date,
    p_end_date,
    nullif(btrim(coalesce(p_reason, '')), ''),
    'pending_manager',
    'manager',
    now()
  )
  returning id into v_request_id;

  insert into public.leave_request_details(
    request_id,
    leave_type_id,
    days_requested,
    employee_note
  )
  values (
    v_request_id,
    p_leave_type_id,
    v_days,
    nullif(btrim(coalesce(p_reason, '')), '')
  );

  insert into public.request_approvals(
    request_id,
    stage,
    approver_id,
    decision
  )
  values (
    v_request_id,
    'manager',
    v_manager,
    'pending'
  );

  perform private.request_notify(
    v_manager,
    'request_approval_required',
    format('Request #%s needs review', (select request_number from public.requests where id = v_request_id)),
    format('%s submitted a leave request.', v_actor_profile.full_name),
    v_request_id
  );

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason
  )
  values (
    v_actor,
    'request_submitted',
    'request',
    v_request_id::text,
    jsonb_build_object(
      'request_type', 'leave',
      'start_date', p_start_date,
      'end_date', p_end_date,
      'days_requested', v_days
    ),
    'Employee submitted request'
  );

  return v_request_id;
end;
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
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid;
  v_actor_profile public.profiles%rowtype;
  v_manager uuid;
  v_request_id uuid;
  v_today date;
  v_end_date date;
  v_duration integer;
  v_start_minutes integer;
  v_end_minutes integer;
begin
  v_actor := private.current_profile_id();

  if v_actor is null then
    raise exception 'Active EMS profile required.';
  end if;

  if p_request_type not in ('shift_change', 'hour_change') then
    raise exception 'Invalid schedule request type.';
  end if;

  if p_new_start_time is null or p_new_end_time is null then
    raise exception 'Start and end times are required.';
  end if;

  select * into v_actor_profile
  from public.profiles
  where id = v_actor
  for share;

  v_today := (now() at time zone v_actor_profile.timezone)::date;
  v_end_date := case
    when p_request_type = 'hour_change' then coalesce(p_end_date, p_start_date)
    when p_is_permanent then p_start_date
    else p_end_date
  end;

  if p_start_date is null or v_end_date is null or v_end_date < p_start_date then
    raise exception 'Enter a valid request date range.';
  end if;

  if p_start_date < v_today then
    raise exception 'Schedule changes cannot start in the past.';
  end if;

  if p_request_type = 'hour_change' and p_is_permanent then
    raise exception 'Hour changes are temporary. Use Shift Change for a permanent schedule change.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for schedule changes.';
  end if;

  v_start_minutes :=
    extract(hour from p_new_start_time)::integer * 60
    + extract(minute from p_new_start_time)::integer;
  v_end_minutes :=
    extract(hour from p_new_end_time)::integer * 60
    + extract(minute from p_new_end_time)::integer;

  v_duration := v_end_minutes - v_start_minutes;
  if v_duration <= 0 then
    v_duration := v_duration + 1440;
  end if;

  if v_duration < 60 or v_duration > 960 then
    raise exception 'Requested work hours must span between 1 and 16 hours.';
  end if;

  if exists (
    select 1
    from public.requests r
    join public.schedule_change_details scd on scd.request_id = r.id
    where r.employee_id = v_actor
      and r.request_type in ('shift_change', 'hour_change')
      and r.status in ('pending_manager', 'pending_final')
      and (
        scd.is_permanent
        or p_is_permanent
        or (r.start_date <= v_end_date and r.end_date >= p_start_date)
      )
  ) then
    raise exception 'Another schedule-change request is already pending.';
  end if;

  if not p_is_permanent
     and not exists (
       select 1
       from public.schedule_assignments sa
       where sa.employee_id = v_actor
         and sa.effective_from <= p_start_date
         and (sa.effective_to is null or sa.effective_to >= v_end_date)
     ) then
    raise exception 'Your current schedule does not cover the requested dates.';
  end if;

  v_manager := private.request_active_manager_id(v_actor, v_today);

  if v_manager is null then
    raise exception 'No active approver is configured for your profile.';
  end if;

  if v_manager = v_actor then
    raise exception 'Self-approval is not allowed.';
  end if;

  insert into public.requests(
    employee_id,
    request_type,
    start_date,
    end_date,
    reason,
    status,
    current_stage,
    submitted_at
  )
  values (
    v_actor,
    p_request_type,
    p_start_date,
    v_end_date,
    btrim(p_reason),
    'pending_manager',
    'manager',
    now()
  )
  returning id into v_request_id;

  insert into public.schedule_change_details(
    request_id,
    new_start_time,
    new_end_time,
    is_permanent
  )
  values (
    v_request_id,
    p_new_start_time,
    p_new_end_time,
    case when p_request_type = 'hour_change' then false else p_is_permanent end
  );

  insert into public.request_approvals(
    request_id,
    stage,
    approver_id,
    decision
  )
  values (
    v_request_id,
    'manager',
    v_manager,
    'pending'
  );

  perform private.request_notify(
    v_manager,
    'request_approval_required',
    format('Request #%s needs review', (select request_number from public.requests where id = v_request_id)),
    format(
      '%s submitted a %s request.',
      v_actor_profile.full_name,
      case when p_request_type = 'shift_change' then 'shift change' else 'hour change' end
    ),
    v_request_id
  );

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason
  )
  values (
    v_actor,
    'request_submitted',
    'request',
    v_request_id::text,
    jsonb_build_object(
      'request_type', p_request_type,
      'start_date', p_start_date,
      'end_date', v_end_date,
      'new_start_time', p_new_start_time,
      'new_end_time', p_new_end_time,
      'is_permanent', case when p_request_type = 'hour_change' then false else p_is_permanent end
    ),
    'Employee submitted request'
  );

  return v_request_id;
end;
$$;

create or replace function public.request_cancel(
  p_request_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid;
  v_request public.requests%rowtype;
  v_pending_approver uuid;
begin
  v_actor := private.current_profile_id();

  if v_actor is null then
    raise exception 'Active EMS profile required.';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found or v_request.employee_id <> v_actor then
    raise exception 'Request not found.';
  end if;

  if v_request.status not in ('draft', 'pending_manager', 'pending_final') then
    raise exception 'Only pending requests can be cancelled.';
  end if;

  select approver_id into v_pending_approver
  from public.request_approvals
  where request_id = p_request_id
    and decision = 'pending'
  order by created_at desc
  limit 1;

  update public.request_approvals
  set
    comment = concat_ws(
      ' · ',
      nullif(comment, ''),
      'Cancelled by requester'
    ),
    updated_at = now()
  where request_id = p_request_id
    and decision = 'pending';

  update public.requests
  set
    status = 'cancelled',
    current_stage = null,
    cancelled_at = now(),
    completed_at = now(),
    cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_request_id;

  if v_pending_approver is not null then
    perform private.request_notify(
      v_pending_approver,
      'request_cancelled',
      format('Request #%s cancelled', v_request.request_number),
      'The employee cancelled this request before final approval.',
      v_request.id
    );
  end if;

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason
  )
  values (
    v_actor,
    'request_cancelled',
    'request',
    v_request.id::text,
    jsonb_build_object('status', v_request.status),
    jsonb_build_object('status', 'cancelled'),
    coalesce(
      nullif(btrim(coalesce(p_reason, '')), ''),
      'Employee cancelled pending request'
    )
  );
end;
$$;

create or replace function public.request_decide(
  p_request_id uuid,
  p_decision public.approval_decision,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid;
  v_actor_role public.app_role;
  v_request public.requests%rowtype;
  v_approval public.request_approvals%rowtype;
  v_final_approver uuid;
  v_require_final boolean;
  v_employee_name text;
begin
  v_actor := private.current_profile_id();
  v_actor_role := private.current_app_role();

  if v_actor is null or v_actor_role is null then
    raise exception 'Active EMS profile required.';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  if p_decision = 'rejected'
     and nullif(btrim(coalesce(p_comment, '')), '') is null then
    raise exception 'A rejection comment is required.';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if v_request.employee_id = v_actor then
    raise exception 'You cannot approve your own request.';
  end if;

  if v_request.status not in ('pending_manager', 'pending_final')
     or v_request.current_stage is null then
    raise exception 'Request is no longer awaiting approval.';
  end if;

  select * into v_approval
  from public.request_approvals
  where request_id = p_request_id
    and stage = v_request.current_stage
    and approver_id = v_actor
    and decision = 'pending'
  for update;

  if not found then
    raise exception 'This request is not assigned to you for approval.';
  end if;

  if v_approval.stage = 'manager'
     and not private.can_manage_employee(v_request.employee_id) then
    raise exception 'You no longer manage this employee.';
  end if;

  if v_approval.stage = 'final' and v_actor_role <> 'super_admin' then
    raise exception 'Final approval requires Super Admin access.';
  end if;

  update public.request_approvals
  set
    decision = p_decision,
    comment = nullif(btrim(coalesce(p_comment, '')), ''),
    decided_at = now(),
    updated_at = now()
  where id = v_approval.id;

  select full_name into v_employee_name
  from public.profiles
  where id = v_request.employee_id;

  if p_decision = 'rejected' then
    update public.requests
    set
      status = 'rejected',
      current_stage = null,
      completed_at = now()
    where id = p_request_id;

    perform private.request_notify(
      v_request.employee_id,
      'request_rejected',
      format('Request #%s rejected', v_request.request_number),
      coalesce(nullif(btrim(p_comment), ''), 'Your request was not approved.'),
      v_request.id
    );

    insert into public.audit_logs(
      actor_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data,
      reason
    )
    values (
      v_actor,
      'request_rejected',
      'request',
      v_request.id::text,
      jsonb_build_object('status', v_request.status, 'stage', v_approval.stage),
      jsonb_build_object('status', 'rejected'),
      nullif(btrim(p_comment), '')
    );

    return;
  end if;

  if v_approval.stage = 'manager' then
    select require_final_request_approval
    into v_require_final
    from public.company_settings
    where id = 1;

    if coalesce(v_require_final, true) and v_actor_role <> 'super_admin' then
      v_final_approver := private.request_final_approver_id(v_request.employee_id);

      if v_final_approver is null then
        raise exception 'No active final approver is configured.';
      end if;

      insert into public.request_approvals(
        request_id,
        stage,
        approver_id,
        decision
      )
      values (
        v_request.id,
        'final',
        v_final_approver,
        'pending'
      )
      on conflict (request_id, stage) do update
      set
        approver_id = excluded.approver_id,
        decision = 'pending',
        comment = null,
        decided_at = null,
        updated_at = now();

      update public.requests
      set
        status = 'pending_final',
        current_stage = 'final'
      where id = v_request.id;

      perform private.request_notify(
        v_final_approver,
        'request_final_approval_required',
        format('Request #%s needs final approval', v_request.request_number),
        format('%s''s request passed manager approval.', v_employee_name),
        v_request.id
      );

      perform private.request_notify(
        v_request.employee_id,
        'request_manager_approved',
        format('Request #%s manager-approved', v_request.request_number),
        'Your request is waiting for final approval.',
        v_request.id
      );

      insert into public.audit_logs(
        actor_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        reason
      )
      values (
        v_actor,
        'request_manager_approved',
        'request',
        v_request.id::text,
        jsonb_build_object('status', v_request.status),
        jsonb_build_object('status', 'pending_final', 'approver_id', v_final_approver),
        nullif(btrim(coalesce(p_comment, '')), '')
      );

      return;
    end if;
  end if;

  perform private.request_apply_approved(v_request.id, v_actor);
end;
$$;

revoke all on function public.request_submit_leave(uuid, date, date, text)
  from public, anon;
revoke all on function public.request_submit_schedule_change(public.request_type, date, date, time, time, boolean, text)
  from public, anon;
revoke all on function public.request_cancel(uuid, text)
  from public, anon;
revoke all on function public.request_decide(uuid, public.approval_decision, text)
  from public, anon;

grant execute on function public.request_submit_leave(uuid, date, date, text)
  to authenticated;
grant execute on function public.request_submit_schedule_change(public.request_type, date, date, time, time, boolean, text)
  to authenticated;
grant execute on function public.request_cancel(uuid, text)
  to authenticated;
grant execute on function public.request_decide(uuid, public.approval_decision, text)
  to authenticated;

revoke all on function private.request_active_manager_id(uuid, date)
  from public, anon, authenticated;
revoke all on function private.request_final_approver_id(uuid)
  from public, anon, authenticated;
revoke all on function private.request_working_days(uuid, date, date)
  from public, anon, authenticated;
revoke all on function private.request_notify(uuid, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function private.request_create_fixed_schedule(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.request_apply_schedule_change(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.request_apply_approved(uuid, uuid)
  from public, anon, authenticated;

drop policy if exists requests_insert_own on public.requests;
drop policy if exists leave_request_details_write_own on public.leave_request_details;
drop policy if exists leave_request_details_update_own on public.leave_request_details;
drop policy if exists schedule_change_details_write_own on public.schedule_change_details;
drop policy if exists schedule_change_details_update_own on public.schedule_change_details;

revoke insert, update, delete on public.requests from authenticated;
revoke insert, update, delete on public.leave_request_details from authenticated;
revoke insert, update, delete on public.schedule_change_details from authenticated;
revoke insert, update, delete on public.request_approvals from authenticated;
revoke insert, update, delete on public.leave_ledger from authenticated;

grant select on public.requests to authenticated;
grant select on public.leave_request_details to authenticated;
grant select on public.schedule_change_details to authenticated;
grant select on public.request_approvals to authenticated;
grant select on public.leave_ledger to authenticated;

notify pgrst, 'reload schema';
