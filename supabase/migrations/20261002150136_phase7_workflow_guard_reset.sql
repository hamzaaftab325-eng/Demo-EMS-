create or replace function public.phase7_assign_scrum_task(
  p_employee_id uuid,
  p_project_code text,
  p_title text,
  p_description text default null
)
returns uuid
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor uuid;
  v_item_id uuid;
begin
  v_actor := private.current_profile_id();

  if v_actor is null then
    raise exception 'Active EMS profile required.';
  end if;

  if p_employee_id is null or p_employee_id = v_actor then
    raise exception 'Choose another employee in your reporting scope.';
  end if;

  if not private.can_manage_employee(p_employee_id) then
    raise exception 'You cannot manage this employee.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_employee_id
      and p.is_active
      and p.employment_status <> 'deactivated'
      and p.deleted_at is null
  ) then
    raise exception 'The selected employee is not active.';
  end if;

  if nullif(btrim(coalesce(p_title, '')), '') is null then
    raise exception 'Task title is required.';
  end if;

  perform set_config('app.phase4_workflow', 'on', true);

  begin
    insert into public.scrum_items(
      employee_id,
      project_code,
      title,
      description,
      status,
      source,
      created_by,
      assigned_by
    )
    values(
      p_employee_id,
      nullif(upper(btrim(coalesce(p_project_code, ''))), ''),
      btrim(p_title),
      nullif(btrim(coalesce(p_description, '')), ''),
      'backlog',
      'manager',
      v_actor,
      v_actor
    )
    returning id into v_item_id;

    perform set_config('app.phase4_workflow', 'off', true);
  exception when others then
    perform set_config('app.phase4_workflow', 'off', true);
    raise;
  end;

  return v_item_id;
end;
$function$;

create or replace function public.phase7_resolve_scrum_obstacle(
  p_obstacle_id uuid,
  p_resolution_note text
)
returns uuid
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor uuid;
  v_employee_id uuid;
begin
  v_actor := private.current_profile_id();

  if v_actor is null then
    raise exception 'Active EMS profile required.';
  end if;

  if nullif(btrim(coalesce(p_resolution_note, '')), '') is null then
    raise exception 'Resolution note is required.';
  end if;

  select w.employee_id
  into v_employee_id
  from public.scrum_obstacles so
  join public.scrum_entries se on se.id = so.scrum_entry_id
  join public.workdays w on w.id = se.workday_id
  where so.id = p_obstacle_id
    and so.status = 'open'
  limit 1;

  if v_employee_id is null then
    raise exception 'Open blocker not found.';
  end if;

  if v_employee_id = v_actor
     or not private.can_manage_employee(v_employee_id) then
    raise exception 'You cannot manage this blocker.';
  end if;

  perform set_config('app.phase4_workflow', 'on', true);

  begin
    update public.scrum_obstacles
    set status = 'resolved',
        resolved_at = now(),
        resolved_by = v_actor,
        resolution_note = btrim(p_resolution_note)
    where id = p_obstacle_id
      and status = 'open';

    if not found then
      raise exception 'Open blocker not found.';
    end if;

    perform set_config('app.phase4_workflow', 'off', true);
  exception when others then
    perform set_config('app.phase4_workflow', 'off', true);
    raise;
  end;

  return p_obstacle_id;
end;
$function$;
