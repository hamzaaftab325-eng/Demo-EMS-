begin;

update public.profiles
set
  full_name='Rayan Enzo',
  job_title='CEO',
  department_id=(select id from public.departments where code='LEAD'),
  role='super_admin',
  employment_status='active',
  is_active=true,
  is_test_account=true,
  updated_at=now()
where employee_code='EMS-DEMO-001';

insert into public.profiles (
  employee_code,email,full_name,job_title,department_id,employment_type,role,
  employment_status,timezone,is_active,is_test_account,created_at,updated_at
)
values
(
  'EMS-DEMO-002','director1@example.test','Faisal Ahmed Siddiqui','Director',
  (select id from public.departments where code='LEAD'),
  'full_time','director','active','Asia/Karachi',true,true,now(),now()
),
(
  'EMS-DEMO-003','manager1@example.test','Danish Mehmood','Manager',
  (select id from public.departments where code='WEB'),
  'full_time','manager','active','Asia/Karachi',true,true,now(),now()
),
(
  'EMS-DEMO-004','employee1@example.test','Hamza Aftab','UX Designer & Front-End Developer',
  (select id from public.departments where code='WEB'),
  'full_time','employee','active','Asia/Karachi',true,true,now(),now()
),
(
  'EMS-DEMO-005','employee2@example.test','Ghulam','UX Designer & Front-End Developer',
  (select id from public.departments where code='WEB'),
  'full_time','employee','active','Asia/Karachi',true,true,now(),now()
),
(
  'EMS-DEMO-006','employee3@example.test','Haider Razaq','Jr. Full-Stack Developer',
  (select id from public.departments where code='WEB'),
  'full_time','employee','active','Asia/Karachi',true,true,now(),now()
),
(
  'EMS-DEMO-007','employee4@example.test','Rida-e-Ayesha','UX Designer & Front-End Coordinator',
  (select id from public.departments where code='WEB'),
  'full_time','employee','active','Asia/Karachi',true,true,now(),now()
)
on conflict (employee_code) do update set
  email=excluded.email,
  full_name=excluded.full_name,
  job_title=excluded.job_title,
  department_id=excluded.department_id,
  employment_type=excluded.employment_type,
  role=excluded.role,
  employment_status='active',
  timezone=excluded.timezone,
  is_active=true,
  is_test_account=true,
  deactivated_at=null,
  deactivation_reason=null,
  updated_at=now();

insert into public.reporting_lines (
  employee_id,manager_id,effective_from,is_primary,created_by
)
values
(
  (select id from public.profiles where employee_code='EMS-DEMO-002'),
  (select id from public.profiles where employee_code='EMS-DEMO-001'),
  current_date,true,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-003'),
  (select id from public.profiles where employee_code='EMS-DEMO-002'),
  current_date,true,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-004'),
  (select id from public.profiles where employee_code='EMS-DEMO-003'),
  current_date,true,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-005'),
  (select id from public.profiles where employee_code='EMS-DEMO-003'),
  current_date,true,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-006'),
  (select id from public.profiles where employee_code='EMS-DEMO-003'),
  current_date,true,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-007'),
  (select id from public.profiles where employee_code='EMS-DEMO-003'),
  current_date,true,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
)
on conflict (employee_id) where (is_primary and effective_to is null)
do update set
  manager_id=excluded.manager_id,
  created_by=excluded.created_by;

insert into public.schedule_assignments (
  employee_id,schedule_id,effective_from,assigned_by
)
values
(
  (select id from public.profiles where employee_code='EMS-DEMO-001'),
  (select id from public.work_schedules where name='Flexible 8h'),
  current_date,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-002'),
  (select id from public.work_schedules where name='Flexible 8h'),
  current_date,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-003'),
  (select id from public.work_schedules where name='Web Flexible 8h Core 12-4'),
  current_date,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-004'),
  (select id from public.work_schedules where name='Web Flexible 8h Core 12-4'),
  current_date,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-005'),
  (select id from public.work_schedules where name='Web Flexible 8h Core 12-4'),
  current_date,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-006'),
  (select id from public.work_schedules where name='Web Flexible 8h Core 12-4'),
  current_date,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
),
(
  (select id from public.profiles where employee_code='EMS-DEMO-007'),
  (select id from public.work_schedules where name='Web Flexible 8h Core 12-4'),
  current_date,
  (select id from public.profiles where employee_code='EMS-DEMO-001')
)
on conflict (employee_id) where (effective_to is null)
do update set
  schedule_id=excluded.schedule_id,
  assigned_by=excluded.assigned_by;

insert into public.employee_status_history (
  employee_id,old_status,new_status,reason,changed_by
)
select
  p.id,null,'active','Demo employee seeded for Phase 3',
  (select id from public.profiles where employee_code='EMS-DEMO-001')
from public.profiles p
where p.employee_code in (
  'EMS-DEMO-002','EMS-DEMO-003','EMS-DEMO-004',
  'EMS-DEMO-005','EMS-DEMO-006','EMS-DEMO-007'
)
and not exists (
  select 1 from public.employee_status_history h
  where h.employee_id=p.id
);

commit;
