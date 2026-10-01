-- eMarketSelect EMS canonical database baseline
-- Captured from the live Supabase project on 2026-10-01.
-- Purpose: Phase 1 version-control baseline for the canonical 29-table EMS schema.
-- This is a reference snapshot of the live schema. Do not apply it to the
-- existing project; the existing project predates migration tracking.
-- Later files under supabase/migrations/ remain the chronological change log.

create extension if not exists pgcrypto;

-- Public enum vocabulary
create type public.app_role as enum ('employee', 'manager', 'director', 'super_admin');
create type public.approval_decision as enum ('pending', 'approved', 'rejected');
create type public.approval_stage as enum ('manager', 'final');
create type public.attendance_event_type as enum ('sign_in', 'sign_off', 'sign_back_in', 'auto_sign_off', 'correction');
create type public.attendance_status as enum ('present', 'late', 'absent', 'on_leave', 'partial', 'holiday', 'weekend', 'missing_sign_off');
create type public.employment_status as enum ('active', 'on_leave', 'deactivated');
create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'intern');
create type public.import_status as enum ('pending', 'processing', 'completed', 'failed');
create type public.interval_status as enum ('active', 'completed', 'corrected');
create type public.interval_type as enum ('break', 'meeting');
create type public.leave_transaction_type as enum ('allocation', 'approved_leave', 'adjustment', 'reversal');
create type public.obstacle_stage as enum ('sign_in', 'during_day', 'sign_off');
create type public.obstacle_status as enum ('open', 'resolved', 'dismissed');
create type public.presence_status as enum ('active', 'idle', 'away', 'on_break', 'in_meeting', 'offline', 'workday_ended');
create type public.request_status as enum ('draft', 'pending_manager', 'pending_final', 'approved', 'rejected', 'cancelled');
create type public.request_type as enum ('leave', 'shift_change', 'hour_change');
create type public.schedule_type as enum ('fixed', 'flexible', 'flexible_core');
create type public.scrum_entry_status as enum ('draft', 'signed_in', 'signed_off', 'reopened');
create type public.scrum_item_source as enum ('employee', 'manager', 'carried_over', 'backlog');
create type public.scrum_progress_event as enum ('sign_in', 'update', 'sign_off', 'manager_update', 'system');
create type public.scrum_task_status as enum ('backlog', 'active', 'completed', 'cancelled');
create type public.workday_status as enum ('not_started', 'working', 'on_break', 'in_meeting', 'signed_off');

-- Canonical tables
create table public.attendance_corrections (
  id uuid default gen_random_uuid() not null,
  workday_id uuid not null,
  field_name text not null,
  old_value jsonb,
  new_value jsonb not null,
  reason text not null,
  requested_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.attendance_events (
  id uuid default gen_random_uuid() not null,
  workday_id uuid not null,
  event_type attendance_event_type not null,
  occurred_at timestamp with time zone default now() not null,
  source text default 'ems'::text not null,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.audit_logs (
  id bigint generated always as identity not null,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamp with time zone default now() not null
);

create table public.company_settings (
  id smallint default 1 not null,
  company_name text default 'eMarketSelect'::text not null,
  timezone text default 'Asia/Karachi'::text not null,
  default_schedule_id uuid,
  default_daily_target_minutes integer default 480 not null,
  grace_period_minutes integer default 15 not null,
  auto_signoff_idle_minutes integer default 240 not null,
  require_scrum_for_signin boolean default true not null,
  require_scrum_for_signoff boolean default true not null,
  require_final_request_approval boolean default true not null,
  updated_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  heartbeat_interval_seconds integer default 60 not null,
  presence_idle_minutes integer default 5 not null,
  presence_away_minutes integer default 15 not null,
  heartbeat_stale_minutes integer default 3 not null
);

create table public.departments (
  id uuid default gen_random_uuid() not null,
  name text not null,
  code text not null,
  description text,
  is_active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.employee_presence (
  employee_id uuid not null,
  workday_id uuid,
  status presence_status default 'offline'::presence_status not null,
  last_heartbeat_at timestamp with time zone,
  last_activity_at timestamp with time zone,
  status_changed_at timestamp with time zone default now() not null,
  tab_connected boolean default false not null,
  updated_at timestamp with time zone default now() not null
);

create table public.employee_status_history (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  old_status employment_status,
  new_status employment_status not null,
  effective_at timestamp with time zone default now() not null,
  reason text,
  changed_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.holidays (
  id uuid default gen_random_uuid() not null,
  name text not null,
  holiday_date date not null,
  country_code text,
  department_id uuid,
  is_company_wide boolean default true not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.import_errors (
  id uuid default gen_random_uuid() not null,
  import_id uuid not null,
  row_number integer not null,
  field_name text,
  message text not null,
  raw_data jsonb,
  created_at timestamp with time zone default now() not null
);

create table public.imports (
  id uuid default gen_random_uuid() not null,
  import_type text not null,
  file_name text not null,
  total_rows integer default 0 not null,
  successful_rows integer default 0 not null,
  failed_rows integer default 0 not null,
  status import_status default 'pending'::import_status not null,
  uploaded_by uuid,
  created_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone
);

create table public.leave_ledger (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  leave_type_id uuid not null,
  transaction_type leave_transaction_type not null,
  days numeric(6,2) not null,
  request_id uuid,
  effective_date date not null,
  note text,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.leave_request_details (
  request_id uuid not null,
  leave_type_id uuid not null,
  days_requested numeric(6,2) not null,
  employee_note text
);

create table public.leave_types (
  id uuid default gen_random_uuid() not null,
  code text not null,
  name text not null,
  is_paid boolean default true not null,
  requires_reason boolean default false not null,
  requires_attachment boolean default false not null,
  default_annual_days numeric(6,2),
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.notifications (
  id uuid default gen_random_uuid() not null,
  recipient_id uuid not null,
  type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  is_read boolean default false not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.presence_events (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  workday_id uuid,
  status presence_status not null,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.profiles (
  id uuid default gen_random_uuid() not null,
  auth_user_id uuid,
  employee_code text not null,
  email text not null,
  full_name text not null,
  job_title text not null,
  department_id uuid not null,
  employment_type employment_type default 'full_time'::employment_type not null,
  role app_role default 'employee'::app_role not null,
  employment_status employment_status default 'active'::employment_status not null,
  timezone text default 'Asia/Karachi'::text not null,
  avatar_url text,
  hire_date date,
  is_active boolean default true not null,
  last_login_at timestamp with time zone,
  deactivated_at timestamp with time zone,
  deactivation_reason text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  is_test_account boolean default false not null,
  auth_invited_at timestamp with time zone,
  auth_activated_at timestamp with time zone
);

create table public.reporting_lines (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  manager_id uuid not null,
  effective_from date default CURRENT_DATE not null,
  effective_to date,
  is_primary boolean default true not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.request_approvals (
  id uuid default gen_random_uuid() not null,
  request_id uuid not null,
  stage approval_stage not null,
  approver_id uuid not null,
  decision approval_decision default 'pending'::approval_decision not null,
  comment text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.requests (
  id uuid default gen_random_uuid() not null,
  request_number bigint generated always as identity not null,
  employee_id uuid not null,
  request_type request_type not null,
  start_date date not null,
  end_date date not null,
  reason text,
  status request_status default 'draft'::request_status not null,
  current_stage approval_stage,
  submitted_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  cancellation_reason text
);

create table public.schedule_assignments (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  schedule_id uuid not null,
  effective_from date not null,
  effective_to date,
  assigned_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.schedule_change_details (
  request_id uuid not null,
  new_start_time time without time zone not null,
  new_end_time time without time zone not null,
  is_permanent boolean default false not null,
  applied_schedule_id uuid,
  applied_at timestamp with time zone
);

create table public.scrum_entries (
  id uuid default gen_random_uuid() not null,
  workday_id uuid not null,
  status scrum_entry_status default 'draft'::scrum_entry_status not null,
  signed_in_at timestamp with time zone,
  signed_off_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.scrum_entry_items (
  id uuid default gen_random_uuid() not null,
  scrum_entry_id uuid not null,
  scrum_item_id uuid not null,
  starting_percent integer default 0 not null,
  final_percent integer,
  sign_off_note text,
  carried_from_entry_item_id uuid,
  added_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);

create table public.scrum_item_progress (
  id uuid default gen_random_uuid() not null,
  scrum_entry_item_id uuid not null,
  percent integer not null,
  note text,
  event_type scrum_progress_event default 'update'::scrum_progress_event not null,
  recorded_by uuid,
  recorded_at timestamp with time zone default now() not null
);

create table public.scrum_items (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  project_code text,
  title text not null,
  description text,
  status scrum_task_status default 'backlog'::scrum_task_status not null,
  source scrum_item_source default 'employee'::scrum_item_source not null,
  created_by uuid,
  assigned_by uuid,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.scrum_obstacles (
  id uuid default gen_random_uuid() not null,
  scrum_entry_id uuid not null,
  description text not null,
  reported_stage obstacle_stage not null,
  status obstacle_status default 'open'::obstacle_status not null,
  reported_at timestamp with time zone default now() not null,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolution_note text
);

create table public.work_intervals (
  id uuid default gen_random_uuid() not null,
  workday_id uuid not null,
  interval_type interval_type not null,
  status interval_status default 'active'::interval_status not null,
  started_at timestamp with time zone default now() not null,
  ended_at timestamp with time zone,
  notes text,
  corrected_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.work_schedules (
  id uuid default gen_random_uuid() not null,
  name text not null,
  schedule_type schedule_type not null,
  daily_target_minutes integer not null,
  start_time time without time zone,
  end_time time without time zone,
  core_start_time time without time zone,
  core_end_time time without time zone,
  grace_minutes integer default 15 not null,
  timezone text default 'Asia/Karachi'::text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.workdays (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  work_date date not null,
  schedule_id uuid,
  timezone text default 'Asia/Karachi'::text not null,
  status workday_status default 'not_started'::workday_status not null,
  attendance_status attendance_status,
  notes text,
  closed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  scheduled_minutes integer default 0 not null,
  first_sign_in_at timestamp with time zone,
  final_sign_off_at timestamp with time zone,
  gross_minutes integer default 0 not null,
  break_minutes integer default 0 not null,
  meeting_minutes integer default 0 not null,
  net_work_minutes integer default 0 not null,
  late_minutes integer default 0 not null,
  early_leave_minutes integer default 0 not null,
  overtime_minutes integer default 0 not null,
  calculated_at timestamp with time zone
);

-- Constraints and relationships
alter table public.attendance_corrections add constraint attendance_corrections_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.attendance_corrections add constraint attendance_corrections_field_nonempty CHECK (btrim(field_name) <> ''::text);
alter table public.attendance_corrections add constraint attendance_corrections_pkey PRIMARY KEY (id);
alter table public.attendance_corrections add constraint attendance_corrections_reason_nonempty CHECK (btrim(reason) <> ''::text);
alter table public.attendance_corrections add constraint attendance_corrections_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.attendance_corrections add constraint attendance_corrections_workday_id_fkey FOREIGN KEY (workday_id) REFERENCES workdays(id) ON DELETE RESTRICT;
alter table public.attendance_events add constraint attendance_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.attendance_events add constraint attendance_events_pkey PRIMARY KEY (id);
alter table public.attendance_events add constraint attendance_events_source_nonempty CHECK (btrim(source) <> ''::text);
alter table public.attendance_events add constraint attendance_events_workday_id_fkey FOREIGN KEY (workday_id) REFERENCES workdays(id) ON DELETE RESTRICT;
alter table public.audit_logs add constraint audit_logs_action_nonempty CHECK (btrim(action) <> ''::text);
alter table public.audit_logs add constraint audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.audit_logs add constraint audit_logs_entity_type_nonempty CHECK (btrim(entity_type) <> ''::text);
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.company_settings add constraint company_settings_auto_signoff_valid CHECK (auto_signoff_idle_minutes >= 15 AND auto_signoff_idle_minutes <= 1440);
alter table public.company_settings add constraint company_settings_default_schedule_id_fkey FOREIGN KEY (default_schedule_id) REFERENCES work_schedules(id) ON DELETE SET NULL;
alter table public.company_settings add constraint company_settings_grace_valid CHECK (grace_period_minutes >= 0 AND grace_period_minutes <= 240);
alter table public.company_settings add constraint company_settings_pkey PRIMARY KEY (id);
alter table public.company_settings add constraint company_settings_presence_thresholds_valid CHECK (heartbeat_interval_seconds >= 30 AND heartbeat_interval_seconds <= 300 AND presence_idle_minutes >= 1 AND presence_idle_minutes <= 120 AND presence_away_minutes > presence_idle_minutes AND presence_away_minutes <= 480 AND heartbeat_stale_minutes >= 2 AND heartbeat_stale_minutes <= 30);
alter table public.company_settings add constraint company_settings_singleton CHECK (id = 1);
alter table public.company_settings add constraint company_settings_target_valid CHECK (default_daily_target_minutes >= 1 AND default_daily_target_minutes <= 1440);
alter table public.company_settings add constraint company_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.departments add constraint departments_code_nonempty CHECK (btrim(code) <> ''::text);
alter table public.departments add constraint departments_name_nonempty CHECK (btrim(name) <> ''::text);
alter table public.departments add constraint departments_pkey PRIMARY KEY (id);
alter table public.employee_presence add constraint employee_presence_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.employee_presence add constraint employee_presence_pkey PRIMARY KEY (employee_id);
alter table public.employee_presence add constraint employee_presence_workday_id_fkey FOREIGN KEY (workday_id) REFERENCES workdays(id) ON DELETE SET NULL;
alter table public.employee_status_history add constraint employee_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.employee_status_history add constraint employee_status_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.employee_status_history add constraint employee_status_history_pkey PRIMARY KEY (id);
alter table public.holidays add constraint holidays_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.holidays add constraint holidays_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
alter table public.holidays add constraint holidays_name_nonempty CHECK (btrim(name) <> ''::text);
alter table public.holidays add constraint holidays_pkey PRIMARY KEY (id);
alter table public.holidays add constraint holidays_scope CHECK (is_company_wide OR department_id IS NOT NULL);
alter table public.import_errors add constraint import_errors_import_id_fkey FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE;
alter table public.import_errors add constraint import_errors_message_nonempty CHECK (btrim(message) <> ''::text);
alter table public.import_errors add constraint import_errors_pkey PRIMARY KEY (id);
alter table public.import_errors add constraint import_errors_row_number_valid CHECK (row_number > 0);
alter table public.imports add constraint imports_pkey PRIMARY KEY (id);
alter table public.imports add constraint imports_row_counts_valid CHECK (total_rows >= 0 AND successful_rows >= 0 AND failed_rows >= 0 AND (successful_rows + failed_rows) <= total_rows);
alter table public.imports add constraint imports_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.leave_ledger add constraint leave_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.leave_ledger add constraint leave_ledger_days_nonzero CHECK (days <> 0::numeric);
alter table public.leave_ledger add constraint leave_ledger_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.leave_ledger add constraint leave_ledger_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT;
alter table public.leave_ledger add constraint leave_ledger_pkey PRIMARY KEY (id);
alter table public.leave_ledger add constraint leave_ledger_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE RESTRICT;
alter table public.leave_ledger add constraint leave_ledger_sign_rule CHECK ((transaction_type = ANY (ARRAY['allocation'::leave_transaction_type, 'adjustment'::leave_transaction_type, 'reversal'::leave_transaction_type])) OR transaction_type = 'approved_leave'::leave_transaction_type AND days < 0::numeric);
alter table public.leave_request_details add constraint leave_request_details_days_valid CHECK (days_requested > 0::numeric);
alter table public.leave_request_details add constraint leave_request_details_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT;
alter table public.leave_request_details add constraint leave_request_details_pkey PRIMARY KEY (request_id);
alter table public.leave_request_details add constraint leave_request_details_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE;
alter table public.leave_types add constraint leave_types_code_nonempty CHECK (btrim(code) <> ''::text);
alter table public.leave_types add constraint leave_types_default_days_valid CHECK (default_annual_days IS NULL OR default_annual_days >= 0::numeric);
alter table public.leave_types add constraint leave_types_name_nonempty CHECK (btrim(name) <> ''::text);
alter table public.leave_types add constraint leave_types_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_read_consistency CHECK (is_read AND read_at IS NOT NULL OR NOT is_read);
alter table public.notifications add constraint notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_title_nonempty CHECK (btrim(title) <> ''::text);
alter table public.notifications add constraint notifications_type_nonempty CHECK (btrim(type) <> ''::text);
alter table public.presence_events add constraint presence_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.presence_events add constraint presence_events_pkey PRIMARY KEY (id);
alter table public.presence_events add constraint presence_events_valid_time CHECK (ended_at IS NULL OR ended_at >= started_at);
alter table public.presence_events add constraint presence_events_workday_id_fkey FOREIGN KEY (workday_id) REFERENCES workdays(id) ON DELETE RESTRICT;
alter table public.profiles add constraint profiles_allowed_email CHECK (lower(email) ~ '^[^@[:space:]]+@emarketselect[.]com$'::text OR is_test_account AND lower(email) ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'::text);
alter table public.profiles add constraint profiles_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_auth_user_id_key UNIQUE (auth_user_id);
alter table public.profiles add constraint profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_deactivation_consistency CHECK (employment_status = 'deactivated'::employment_status AND is_active = false AND deactivated_at IS NOT NULL OR employment_status <> 'deactivated'::employment_status);
alter table public.profiles add constraint profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;
alter table public.profiles add constraint profiles_employee_code_key UNIQUE (employee_code);
alter table public.profiles add constraint profiles_employee_code_nonempty CHECK (btrim(employee_code) <> ''::text);
alter table public.profiles add constraint profiles_full_name_nonempty CHECK (btrim(full_name) <> ''::text);
alter table public.profiles add constraint profiles_job_title_nonempty CHECK (btrim(job_title) <> ''::text);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.reporting_lines add constraint reporting_lines_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.reporting_lines add constraint reporting_lines_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.reporting_lines add constraint reporting_lines_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.reporting_lines add constraint reporting_lines_not_self CHECK (employee_id <> manager_id);
alter table public.reporting_lines add constraint reporting_lines_pkey PRIMARY KEY (id);
alter table public.reporting_lines add constraint reporting_lines_valid_dates CHECK (effective_to IS NULL OR effective_to >= effective_from);
alter table public.request_approvals add constraint request_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.request_approvals add constraint request_approvals_decision_consistency CHECK (decision = 'pending'::approval_decision AND decided_at IS NULL OR decision <> 'pending'::approval_decision AND decided_at IS NOT NULL);
alter table public.request_approvals add constraint request_approvals_pkey PRIMARY KEY (id);
alter table public.request_approvals add constraint request_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE;
alter table public.request_approvals add constraint request_approvals_request_id_stage_key UNIQUE (request_id, stage);
alter table public.requests add constraint requests_cancel_consistency CHECK (status = 'cancelled'::request_status AND cancelled_at IS NOT NULL OR status <> 'cancelled'::request_status);
alter table public.requests add constraint requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.requests add constraint requests_pkey PRIMARY KEY (id);
alter table public.requests add constraint requests_request_number_key UNIQUE (request_number);
alter table public.requests add constraint requests_submission_consistency CHECK (status = 'draft'::request_status AND submitted_at IS NULL OR status <> 'draft'::request_status AND submitted_at IS NOT NULL);
alter table public.requests add constraint requests_valid_dates CHECK (end_date >= start_date);
alter table public.schedule_assignments add constraint schedule_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.schedule_assignments add constraint schedule_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.schedule_assignments add constraint schedule_assignments_pkey PRIMARY KEY (id);
alter table public.schedule_assignments add constraint schedule_assignments_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE RESTRICT;
alter table public.schedule_assignments add constraint schedule_assignments_valid_dates CHECK (effective_to IS NULL OR effective_to >= effective_from);
alter table public.schedule_change_details add constraint schedule_change_details_applied_schedule_id_fkey FOREIGN KEY (applied_schedule_id) REFERENCES work_schedules(id) ON DELETE RESTRICT;
alter table public.schedule_change_details add constraint schedule_change_details_pkey PRIMARY KEY (request_id);
alter table public.schedule_change_details add constraint schedule_change_details_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE;
alter table public.scrum_entries add constraint scrum_entries_pkey PRIMARY KEY (id);
alter table public.scrum_entries add constraint scrum_entries_signin_consistency CHECK (signed_in_at IS NULL OR (status = ANY (ARRAY['signed_in'::scrum_entry_status, 'signed_off'::scrum_entry_status, 'reopened'::scrum_entry_status])));
alter table public.scrum_entries add constraint scrum_entries_signoff_consistency CHECK (signed_off_at IS NULL OR (status = ANY (ARRAY['signed_off'::scrum_entry_status, 'reopened'::scrum_entry_status])));
alter table public.scrum_entries add constraint scrum_entries_workday_id_fkey FOREIGN KEY (workday_id) REFERENCES workdays(id) ON DELETE RESTRICT;
alter table public.scrum_entries add constraint scrum_entries_workday_id_key UNIQUE (workday_id);
alter table public.scrum_entry_items add constraint scrum_entry_items_carried_from_entry_item_id_fkey FOREIGN KEY (carried_from_entry_item_id) REFERENCES scrum_entry_items(id) ON DELETE SET NULL;
alter table public.scrum_entry_items add constraint scrum_entry_items_final_percent CHECK (final_percent IS NULL OR final_percent >= 0 AND final_percent <= 100);
alter table public.scrum_entry_items add constraint scrum_entry_items_pkey PRIMARY KEY (id);
alter table public.scrum_entry_items add constraint scrum_entry_items_scrum_entry_id_fkey FOREIGN KEY (scrum_entry_id) REFERENCES scrum_entries(id) ON DELETE CASCADE;
alter table public.scrum_entry_items add constraint scrum_entry_items_scrum_entry_id_scrum_item_id_key UNIQUE (scrum_entry_id, scrum_item_id);
alter table public.scrum_entry_items add constraint scrum_entry_items_scrum_item_id_fkey FOREIGN KEY (scrum_item_id) REFERENCES scrum_items(id) ON DELETE RESTRICT;
alter table public.scrum_entry_items add constraint scrum_entry_items_start_percent CHECK (starting_percent >= 0 AND starting_percent <= 100);
alter table public.scrum_item_progress add constraint scrum_item_progress_percent CHECK (percent >= 0 AND percent <= 100);
alter table public.scrum_item_progress add constraint scrum_item_progress_pkey PRIMARY KEY (id);
alter table public.scrum_item_progress add constraint scrum_item_progress_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.scrum_item_progress add constraint scrum_item_progress_scrum_entry_item_id_fkey FOREIGN KEY (scrum_entry_item_id) REFERENCES scrum_entry_items(id) ON DELETE CASCADE;
alter table public.scrum_items add constraint scrum_items_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.scrum_items add constraint scrum_items_completion_consistency CHECK (status = 'completed'::scrum_task_status AND completed_at IS NOT NULL OR status <> 'completed'::scrum_task_status);
alter table public.scrum_items add constraint scrum_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.scrum_items add constraint scrum_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.scrum_items add constraint scrum_items_pkey PRIMARY KEY (id);
alter table public.scrum_items add constraint scrum_items_project_code_nonempty CHECK (project_code IS NULL OR btrim(project_code) <> ''::text);
alter table public.scrum_items add constraint scrum_items_title_nonempty CHECK (btrim(title) <> ''::text);
alter table public.scrum_obstacles add constraint scrum_obstacles_description_nonempty CHECK (btrim(description) <> ''::text);
alter table public.scrum_obstacles add constraint scrum_obstacles_pkey PRIMARY KEY (id);
alter table public.scrum_obstacles add constraint scrum_obstacles_resolution_consistency CHECK (status = 'resolved'::obstacle_status AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL OR status <> 'resolved'::obstacle_status);
alter table public.scrum_obstacles add constraint scrum_obstacles_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.scrum_obstacles add constraint scrum_obstacles_scrum_entry_id_fkey FOREIGN KEY (scrum_entry_id) REFERENCES scrum_entries(id) ON DELETE CASCADE;
alter table public.work_intervals add constraint work_intervals_completed_has_end CHECK (status = 'active'::interval_status AND ended_at IS NULL OR (status = ANY (ARRAY['completed'::interval_status, 'corrected'::interval_status])) AND ended_at IS NOT NULL);
alter table public.work_intervals add constraint work_intervals_corrected_by_fkey FOREIGN KEY (corrected_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.work_intervals add constraint work_intervals_pkey PRIMARY KEY (id);
alter table public.work_intervals add constraint work_intervals_valid_time CHECK (ended_at IS NULL OR ended_at >= started_at);
alter table public.work_intervals add constraint work_intervals_workday_id_fkey FOREIGN KEY (workday_id) REFERENCES workdays(id) ON DELETE RESTRICT;
alter table public.work_schedules add constraint work_schedules_core_fields CHECK (schedule_type = 'flexible_core'::schedule_type AND core_start_time IS NOT NULL AND core_end_time IS NOT NULL OR schedule_type <> 'flexible_core'::schedule_type);
alter table public.work_schedules add constraint work_schedules_fixed_fields CHECK (schedule_type = 'fixed'::schedule_type AND start_time IS NOT NULL AND end_time IS NOT NULL OR schedule_type <> 'fixed'::schedule_type);
alter table public.work_schedules add constraint work_schedules_grace_valid CHECK (grace_minutes >= 0 AND grace_minutes <= 240);
alter table public.work_schedules add constraint work_schedules_name_nonempty CHECK (btrim(name) <> ''::text);
alter table public.work_schedules add constraint work_schedules_pkey PRIMARY KEY (id);
alter table public.work_schedules add constraint work_schedules_target_valid CHECK (daily_target_minutes >= 1 AND daily_target_minutes <= 1440);
alter table public.workdays add constraint workdays_attendance_minutes_nonnegative CHECK (scheduled_minutes >= 0 AND gross_minutes >= 0 AND break_minutes >= 0 AND meeting_minutes >= 0 AND net_work_minutes >= 0 AND late_minutes >= 0 AND early_leave_minutes >= 0 AND overtime_minutes >= 0);
alter table public.workdays add constraint workdays_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.workdays add constraint workdays_employee_id_work_date_key UNIQUE (employee_id, work_date);
alter table public.workdays add constraint workdays_pkey PRIMARY KEY (id);
alter table public.workdays add constraint workdays_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE RESTRICT;

-- Non-constraint indexes
CREATE INDEX attendance_corrections_approved_by_idx ON public.attendance_corrections USING btree (approved_by);
CREATE INDEX attendance_corrections_requested_by_idx ON public.attendance_corrections USING btree (requested_by);
CREATE INDEX attendance_corrections_workday_idx ON public.attendance_corrections USING btree (workday_id);
CREATE INDEX attendance_events_created_by_idx ON public.attendance_events USING btree (created_by);
CREATE INDEX attendance_events_workday_time_idx ON public.attendance_events USING btree (workday_id, occurred_at);
CREATE INDEX audit_logs_actor_time_idx ON public.audit_logs USING btree (actor_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs USING btree (entity_type, entity_id, created_at DESC);
CREATE INDEX company_settings_default_schedule_idx ON public.company_settings USING btree (default_schedule_id);
CREATE INDEX company_settings_updated_by_idx ON public.company_settings USING btree (updated_by);
CREATE UNIQUE INDEX departments_code_lower_uidx ON public.departments USING btree (lower(code));
CREATE UNIQUE INDEX departments_name_lower_uidx ON public.departments USING btree (lower(name));
CREATE INDEX employee_presence_status_idx ON public.employee_presence USING btree (status, updated_at DESC);
CREATE INDEX employee_presence_workday_idx ON public.employee_presence USING btree (workday_id);
CREATE INDEX employee_status_history_changed_by_idx ON public.employee_status_history USING btree (changed_by);
CREATE INDEX employee_status_history_employee_idx ON public.employee_status_history USING btree (employee_id, effective_at DESC);
CREATE UNIQUE INDEX holidays_company_date_name_uidx ON public.holidays USING btree (holiday_date, lower(name), COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX holidays_created_by_idx ON public.holidays USING btree (created_by);
CREATE INDEX holidays_department_idx ON public.holidays USING btree (department_id);
CREATE INDEX import_errors_import_idx ON public.import_errors USING btree (import_id, row_number);
CREATE INDEX imports_uploaded_by_idx ON public.imports USING btree (uploaded_by);
CREATE UNIQUE INDEX leave_ledger_approved_request_uidx ON public.leave_ledger USING btree (request_id) WHERE ((transaction_type = 'approved_leave'::leave_transaction_type) AND (request_id IS NOT NULL));
CREATE INDEX leave_ledger_created_by_idx ON public.leave_ledger USING btree (created_by);
CREATE INDEX leave_ledger_employee_type_date_idx ON public.leave_ledger USING btree (employee_id, leave_type_id, effective_date DESC);
CREATE INDEX leave_ledger_leave_type_idx ON public.leave_ledger USING btree (leave_type_id);
CREATE UNIQUE INDEX leave_ledger_request_year_effect_unique ON public.leave_ledger USING btree (request_id, leave_type_id, effective_date, transaction_type) WHERE (request_id IS NOT NULL);
CREATE INDEX leave_request_details_leave_type_idx ON public.leave_request_details USING btree (leave_type_id);
CREATE UNIQUE INDEX leave_types_code_lower_uidx ON public.leave_types USING btree (lower(code));
CREATE UNIQUE INDEX leave_types_name_lower_uidx ON public.leave_types USING btree (lower(name));
CREATE INDEX notifications_recipient_unread_idx ON public.notifications USING btree (recipient_id, is_read, created_at DESC);
CREATE INDEX presence_events_employee_time_idx ON public.presence_events USING btree (employee_id, started_at DESC);
CREATE UNIQUE INDEX presence_events_one_open_per_employee ON public.presence_events USING btree (employee_id) WHERE (ended_at IS NULL);
CREATE INDEX presence_events_workday_idx ON public.presence_events USING btree (workday_id, started_at);
CREATE INDEX profiles_auth_user_idx ON public.profiles USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);
CREATE INDEX profiles_created_by_idx ON public.profiles USING btree (created_by);
CREATE INDEX profiles_department_idx ON public.profiles USING btree (department_id);
CREATE UNIQUE INDEX profiles_email_lower_uidx ON public.profiles USING btree (lower(email));
CREATE INDEX profiles_role_status_idx ON public.profiles USING btree (role, employment_status) WHERE is_active;
CREATE INDEX reporting_lines_created_by_idx ON public.reporting_lines USING btree (created_by);
CREATE INDEX reporting_lines_manager_current_idx ON public.reporting_lines USING btree (manager_id, employee_id) WHERE (effective_to IS NULL);
CREATE UNIQUE INDEX reporting_lines_one_current_primary_uidx ON public.reporting_lines USING btree (employee_id) WHERE (is_primary AND (effective_to IS NULL));
CREATE INDEX request_approvals_approver_pending_idx ON public.request_approvals USING btree (approver_id, decision, created_at DESC);
CREATE INDEX requests_employee_status_idx ON public.requests USING btree (employee_id, status, created_at DESC);
CREATE INDEX requests_stage_status_idx ON public.requests USING btree (current_stage, status, created_at DESC);
CREATE INDEX schedule_assignments_assigned_by_idx ON public.schedule_assignments USING btree (assigned_by);
CREATE INDEX schedule_assignments_employee_dates_idx ON public.schedule_assignments USING btree (employee_id, effective_from DESC, effective_to);
CREATE UNIQUE INDEX schedule_assignments_one_current_uidx ON public.schedule_assignments USING btree (employee_id) WHERE (effective_to IS NULL);
CREATE INDEX schedule_assignments_schedule_idx ON public.schedule_assignments USING btree (schedule_id);
CREATE INDEX schedule_change_details_applied_schedule_idx ON public.schedule_change_details USING btree (applied_schedule_id) WHERE (applied_schedule_id IS NOT NULL);
CREATE INDEX scrum_entry_items_carried_from_idx ON public.scrum_entry_items USING btree (carried_from_entry_item_id);
CREATE INDEX scrum_entry_items_entry_idx ON public.scrum_entry_items USING btree (scrum_entry_id);
CREATE INDEX scrum_entry_items_item_idx ON public.scrum_entry_items USING btree (scrum_item_id);
CREATE INDEX scrum_item_progress_item_time_idx ON public.scrum_item_progress USING btree (scrum_entry_item_id, recorded_at DESC);
CREATE INDEX scrum_item_progress_recorded_by_idx ON public.scrum_item_progress USING btree (recorded_by);
CREATE INDEX scrum_items_assigned_by_idx ON public.scrum_items USING btree (assigned_by);
CREATE INDEX scrum_items_created_by_idx ON public.scrum_items USING btree (created_by);
CREATE INDEX scrum_items_employee_status_idx ON public.scrum_items USING btree (employee_id, status, created_at DESC);
CREATE INDEX scrum_items_project_code_idx ON public.scrum_items USING btree (project_code) WHERE (project_code IS NOT NULL);
CREATE INDEX scrum_obstacles_entry_idx ON public.scrum_obstacles USING btree (scrum_entry_id);
CREATE INDEX scrum_obstacles_resolved_by_idx ON public.scrum_obstacles USING btree (resolved_by);
CREATE INDEX scrum_obstacles_status_idx ON public.scrum_obstacles USING btree (status, reported_at DESC);
CREATE INDEX work_intervals_corrected_by_idx ON public.work_intervals USING btree (corrected_by);
CREATE UNIQUE INDEX work_intervals_one_active_workday_uidx ON public.work_intervals USING btree (workday_id) WHERE (status = 'active'::interval_status);
CREATE INDEX work_intervals_workday_idx ON public.work_intervals USING btree (workday_id, started_at);
CREATE UNIQUE INDEX work_schedules_name_lower_uidx ON public.work_schedules USING btree (lower(name));
CREATE INDEX workdays_date_status_idx ON public.workdays USING btree (work_date DESC, status);
CREATE INDEX workdays_employee_date_idx ON public.workdays USING btree (employee_id, work_date DESC);
CREATE UNIQUE INDEX workdays_one_open_per_employee ON public.workdays USING btree (employee_id) WHERE (status = ANY (ARRAY['working'::workday_status, 'on_break'::workday_status, 'in_meeting'::workday_status]));
CREATE INDEX workdays_schedule_idx ON public.workdays USING btree (schedule_id);
CREATE INDEX workdays_work_date_employee_idx ON public.workdays USING btree (work_date, employee_id);

-- RLS baseline and policies
alter table public.attendance_corrections enable row level security;
alter table public.attendance_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.company_settings enable row level security;
alter table public.departments enable row level security;
alter table public.employee_presence enable row level security;
alter table public.employee_status_history enable row level security;
alter table public.holidays enable row level security;
alter table public.import_errors enable row level security;
alter table public.imports enable row level security;
alter table public.leave_ledger enable row level security;
alter table public.leave_request_details enable row level security;
alter table public.leave_types enable row level security;
alter table public.notifications enable row level security;
alter table public.presence_events enable row level security;
alter table public.profiles enable row level security;
alter table public.reporting_lines enable row level security;
alter table public.request_approvals enable row level security;
alter table public.requests enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.schedule_change_details enable row level security;
alter table public.scrum_entries enable row level security;
alter table public.scrum_entry_items enable row level security;
alter table public.scrum_item_progress enable row level security;
alter table public.scrum_items enable row level security;
alter table public.scrum_obstacles enable row level security;
alter table public.work_intervals enable row level security;
alter table public.work_schedules enable row level security;
alter table public.workdays enable row level security;

-- Policies
create policy attendance_corrections_insert_super on public.attendance_corrections as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy attendance_corrections_read_scope on public.attendance_corrections as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = attendance_corrections.workday_id) AND ( SELECT private.can_access_employee(w.employee_id) AS can_access_employee)))));
create policy attendance_events_insert_own on public.attendance_events as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = attendance_events.workday_id) AND (w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id))))));
create policy attendance_events_read_scope on public.attendance_events as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = attendance_events.workday_id) AND ( SELECT private.can_access_employee(w.employee_id) AS can_access_employee)))));
create policy audit_logs_insert_super on public.audit_logs as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy audit_logs_read_super on public.audit_logs as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_super_admin() AS is_super_admin));
create policy company_settings_delete_super on public.company_settings as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin));
create policy company_settings_insert_super on public.company_settings as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy company_settings_read on public.company_settings as PERMISSIVE for SELECT to authenticated using ((( SELECT private.current_profile_id() AS current_profile_id) IS NOT NULL));
create policy company_settings_update_super on public.company_settings as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin)) with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy departments_delete_super on public.departments as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin));
create policy departments_insert_super on public.departments as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy departments_read on public.departments as PERMISSIVE for SELECT to authenticated using ((( SELECT private.current_profile_id() AS current_profile_id) IS NOT NULL));
create policy departments_update_super on public.departments as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin)) with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy employee_presence_insert_own on public.employee_presence as PERMISSIVE for INSERT to authenticated with check ((employee_id = ( SELECT private.current_profile_id() AS current_profile_id)));
create policy employee_presence_read_scope on public.employee_presence as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_access_employee(employee_presence.employee_id) AS can_access_employee));
create policy employee_presence_update_own on public.employee_presence as PERMISSIVE for UPDATE to authenticated using ((employee_id = ( SELECT private.current_profile_id() AS current_profile_id))) with check ((employee_id = ( SELECT private.current_profile_id() AS current_profile_id)));
create policy employee_status_history_read_scope on public.employee_status_history as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_access_employee(employee_status_history.employee_id) AS can_access_employee));
create policy employee_status_history_write_super on public.employee_status_history as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy holidays_delete_super on public.holidays as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin));
create policy holidays_insert_super on public.holidays as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy holidays_read on public.holidays as PERMISSIVE for SELECT to authenticated using ((( SELECT private.current_profile_id() AS current_profile_id) IS NOT NULL));
create policy holidays_update_super on public.holidays as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin)) with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy import_errors_super on public.import_errors as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_super_admin() AS is_super_admin));
create policy imports_read_super on public.imports as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_super_admin() AS is_super_admin));
create policy leave_ledger_read_scope on public.leave_ledger as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_access_employee(leave_ledger.employee_id) AS can_access_employee));
create policy leave_request_details_read_scope on public.leave_request_details as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM requests r
  WHERE ((r.id = leave_request_details.request_id) AND ( SELECT private.can_access_employee(r.employee_id) AS can_access_employee)))));
create policy leave_types_delete_super on public.leave_types as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin));
create policy leave_types_insert_super on public.leave_types as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy leave_types_read on public.leave_types as PERMISSIVE for SELECT to authenticated using ((( SELECT private.current_profile_id() AS current_profile_id) IS NOT NULL));
create policy leave_types_update_super on public.leave_types as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin)) with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy notifications_read_own on public.notifications as PERMISSIVE for SELECT to authenticated using ((recipient_id = ( SELECT private.current_profile_id() AS current_profile_id)));
create policy notifications_update_own on public.notifications as PERMISSIVE for UPDATE to authenticated using ((recipient_id = ( SELECT private.current_profile_id() AS current_profile_id))) with check ((recipient_id = ( SELECT private.current_profile_id() AS current_profile_id)));
create policy presence_events_insert_own on public.presence_events as PERMISSIVE for INSERT to authenticated with check ((employee_id = ( SELECT private.current_profile_id() AS current_profile_id)));
create policy presence_events_read_scope on public.presence_events as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_access_employee(presence_events.employee_id) AS can_access_employee));
create policy presence_events_update_own on public.presence_events as PERMISSIVE for UPDATE to authenticated using ((employee_id = ( SELECT private.current_profile_id() AS current_profile_id))) with check ((employee_id = ( SELECT private.current_profile_id() AS current_profile_id)));
create policy profiles_insert_super on public.profiles as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy profiles_select_scope on public.profiles as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_access_employee(profiles.id) AS can_access_employee));
create policy profiles_update_super on public.profiles as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin)) with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy reporting_lines_delete_super on public.reporting_lines as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin));
create policy reporting_lines_insert_super on public.reporting_lines as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy reporting_lines_read_scope on public.reporting_lines as PERMISSIVE for SELECT to authenticated using ((( SELECT private.can_access_employee(reporting_lines.employee_id) AS can_access_employee) OR (( SELECT private.current_profile_id() AS current_profile_id) = manager_id)));
create policy reporting_lines_update_super on public.reporting_lines as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin)) with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy request_approvals_read_scope on public.request_approvals as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM requests r
  WHERE ((r.id = request_approvals.request_id) AND ( SELECT private.can_access_employee(r.employee_id) AS can_access_employee)))));
create policy requests_read_scope on public.requests as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_access_employee(requests.employee_id) AS can_access_employee));
create policy schedule_assignments_delete_super on public.schedule_assignments as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin));
create policy schedule_assignments_insert_super on public.schedule_assignments as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy schedule_assignments_read_scope on public.schedule_assignments as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_access_employee(schedule_assignments.employee_id) AS can_access_employee));
create policy schedule_assignments_update_super on public.schedule_assignments as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin)) with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy schedule_change_details_read_scope on public.schedule_change_details as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM requests r
  WHERE ((r.id = schedule_change_details.request_id) AND ( SELECT private.can_access_employee(r.employee_id) AS can_access_employee)))));
create policy scrum_entries_insert_own on public.scrum_entries as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = scrum_entries.workday_id) AND (w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id))))));
create policy scrum_entries_read_scope on public.scrum_entries as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = scrum_entries.workday_id) AND ( SELECT private.can_access_employee(w.employee_id) AS can_access_employee)))));
create policy scrum_entries_update_own on public.scrum_entries as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = scrum_entries.workday_id) AND (w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id)))))) with check ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = scrum_entries.workday_id) AND (w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id))))));
create policy scrum_entry_items_insert_owner_or_manager on public.scrum_entry_items as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM (scrum_entries se
     JOIN workdays w ON ((w.id = se.workday_id)))
  WHERE ((se.id = scrum_entry_items.scrum_entry_id) AND ((w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id)) OR ( SELECT private.can_manage_employee(w.employee_id) AS can_manage_employee))))));
create policy scrum_entry_items_read_scope on public.scrum_entry_items as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM (scrum_entries se
     JOIN workdays w ON ((w.id = se.workday_id)))
  WHERE ((se.id = scrum_entry_items.scrum_entry_id) AND ( SELECT private.can_access_employee(w.employee_id) AS can_access_employee)))));
create policy scrum_entry_items_update_owner on public.scrum_entry_items as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM (scrum_entries se
     JOIN workdays w ON ((w.id = se.workday_id)))
  WHERE ((se.id = scrum_entry_items.scrum_entry_id) AND (w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id)))))) with check ((EXISTS ( SELECT 1
   FROM (scrum_entries se
     JOIN workdays w ON ((w.id = se.workday_id)))
  WHERE ((se.id = scrum_entry_items.scrum_entry_id) AND (w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id))))));
create policy scrum_progress_insert_owner on public.scrum_item_progress as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM ((scrum_entry_items sei
     JOIN scrum_entries se ON ((se.id = sei.scrum_entry_id)))
     JOIN workdays w ON ((w.id = se.workday_id)))
  WHERE ((sei.id = scrum_item_progress.scrum_entry_item_id) AND (w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id))))));
create policy scrum_progress_read_scope on public.scrum_item_progress as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM ((scrum_entry_items sei
     JOIN scrum_entries se ON ((se.id = sei.scrum_entry_id)))
     JOIN workdays w ON ((w.id = se.workday_id)))
  WHERE ((sei.id = scrum_item_progress.scrum_entry_item_id) AND ( SELECT private.can_access_employee(w.employee_id) AS can_access_employee)))));
create policy scrum_items_insert_owner_or_manager on public.scrum_items as PERMISSIVE for INSERT to authenticated with check (((employee_id = ( SELECT private.current_profile_id() AS current_profile_id)) OR ( SELECT private.can_manage_employee(scrum_items.employee_id) AS can_manage_employee)));
create policy scrum_items_read_scope on public.scrum_items as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_access_employee(scrum_items.employee_id) AS can_access_employee));
create policy scrum_items_update_owner_or_manager on public.scrum_items as PERMISSIVE for UPDATE to authenticated using (((employee_id = ( SELECT private.current_profile_id() AS current_profile_id)) OR ( SELECT private.can_manage_employee(scrum_items.employee_id) AS can_manage_employee))) with check (((employee_id = ( SELECT private.current_profile_id() AS current_profile_id)) OR ( SELECT private.can_manage_employee(scrum_items.employee_id) AS can_manage_employee)));
create policy scrum_obstacles_insert_owner on public.scrum_obstacles as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM (scrum_entries se
     JOIN workdays w ON ((w.id = se.workday_id)))
  WHERE ((se.id = scrum_obstacles.scrum_entry_id) AND (w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id))))));
create policy scrum_obstacles_read_scope on public.scrum_obstacles as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM (scrum_entries se
     JOIN workdays w ON ((w.id = se.workday_id)))
  WHERE ((se.id = scrum_obstacles.scrum_entry_id) AND ( SELECT private.can_access_employee(w.employee_id) AS can_access_employee)))));
create policy scrum_obstacles_update_owner_or_manager on public.scrum_obstacles as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM (scrum_entries se
     JOIN workdays w ON ((w.id = se.workday_id)))
  WHERE ((se.id = scrum_obstacles.scrum_entry_id) AND ((w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id)) OR ( SELECT private.can_manage_employee(w.employee_id) AS can_manage_employee)))))) with check ((EXISTS ( SELECT 1
   FROM (scrum_entries se
     JOIN workdays w ON ((w.id = se.workday_id)))
  WHERE ((se.id = scrum_obstacles.scrum_entry_id) AND ((w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id)) OR ( SELECT private.can_manage_employee(w.employee_id) AS can_manage_employee))))));
create policy work_intervals_insert_own on public.work_intervals as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = work_intervals.workday_id) AND (w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id))))));
create policy work_intervals_read_scope on public.work_intervals as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = work_intervals.workday_id) AND ( SELECT private.can_access_employee(w.employee_id) AS can_access_employee)))));
create policy work_intervals_update_own_or_super on public.work_intervals as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = work_intervals.workday_id) AND ((w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id)) OR ( SELECT private.is_super_admin() AS is_super_admin)))))) with check ((EXISTS ( SELECT 1
   FROM workdays w
  WHERE ((w.id = work_intervals.workday_id) AND ((w.employee_id = ( SELECT private.current_profile_id() AS current_profile_id)) OR ( SELECT private.is_super_admin() AS is_super_admin))))));
create policy work_schedules_delete_super on public.work_schedules as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin));
create policy work_schedules_insert_super on public.work_schedules as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy work_schedules_read on public.work_schedules as PERMISSIVE for SELECT to authenticated using ((( SELECT private.current_profile_id() AS current_profile_id) IS NOT NULL));
create policy work_schedules_update_super on public.work_schedules as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_super_admin() AS is_super_admin)) with check (( SELECT private.is_super_admin() AS is_super_admin));
create policy workdays_insert_own on public.workdays as PERMISSIVE for INSERT to authenticated with check ((employee_id = ( SELECT private.current_profile_id() AS current_profile_id)));
create policy workdays_read_scope on public.workdays as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_access_employee(workdays.employee_id) AS can_access_employee));
create policy workdays_update_own_or_super on public.workdays as PERMISSIVE for UPDATE to authenticated using (((employee_id = ( SELECT private.current_profile_id() AS current_profile_id)) OR ( SELECT private.is_super_admin() AS is_super_admin))) with check (((employee_id = ( SELECT private.current_profile_id() AS current_profile_id)) OR ( SELECT private.is_super_admin() AS is_super_admin)));
