import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required Phase 8 file: ${path}`);
  }
  return fs.readFileSync(path, "utf8");
}

function requireText(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label}: expected ${JSON.stringify(needle)}`);
  }
}

function forbidText(content, needle, label) {
  if (content.includes(needle)) {
    throw new Error(`${label}: unexpected ${JSON.stringify(needle)}`);
  }
}

const settings = read("src/app/(app)/settings/page.tsx");
for (const text of [
  "Company settings",
  "Work schedules",
  "Holiday calendar",
  "Leave types",
  "AdminScheduleFields",
  "AdminHolidayScopeFields",
  "RequestSubmitButton",
]) {
  requireText(settings, text, "Settings UI");
}
forbidText(settings, "PhaseNotice", "Settings placeholder removal");

const actions = read("src/app/(app)/settings/actions.ts");
requireText(actions, "requireRole(ADMIN_ROLES)", "Super Admin server action guard");
for (const rpc of [
  "phase8_update_company_settings",
  "phase8_save_schedule",
  "phase8_set_schedule_active",
  "phase8_save_holiday",
  "phase8_delete_holiday",
  "phase8_save_leave_type",
  "phase8_set_leave_type_active",
]) {
  requireText(actions, `rpc("${rpc}"`, `Settings RPC ${rpc}`);
}

const audit = read("src/app/(app)/audit/page.tsx");
requireText(audit, "getAuditSearch", "Audit data query");
requireText(audit, "changedFields", "Audit field diff");
requireText(audit, "admin-audit-filters", "Audit filters");
requireText(audit, "admin-audit-pager", "Audit pagination");
requireText(audit, "<details", "Audit expandable details");
requireText(audit, "requireRole(ADMIN_ROLES)", "Audit Super Admin guard");
forbidText(audit, "PhaseNotice", "Audit placeholder removal");

const data = read("src/lib/data/admin.ts");
for (const table of [
  "company_settings",
  "work_schedules",
  "holidays",
  "leave_types",
  "schedule_change_details",
]) {
  requireText(data, `.from("${table}")`, `Admin data ${table}`);
}
requireText(data, 'rpc("phase8_audit_search"', "Audit search RPC");
requireText(data, "requestGenerated", "Request-generated schedule protection");
requireText(data, "is_test_account", "Audit actor environment scope");

const hardening = read(
  "supabase/migrations/20261002153002_phase8_admin_audit_hardening.sql",
);
for (const text of [
  "is_test_account",
  "audit_logs_environment_time_idx",
  "private.current_test_environment",
  "phase8_record_admin_change",
  "phase8_audit_company_settings",
  "phase8_audit_work_schedules",
  "phase8_audit_holidays",
  "phase8_audit_leave_types",
  "company_settings_phase8_threshold_order",
  "work_schedules_phase8_field_shape",
  "holidays_phase8_exact_scope",
  "leave_types_phase8_code_format",
  "revoke delete, update, truncate, references, trigger",
]) {
  requireText(hardening, text, "Phase 8 admin hardening");
}

const workflows = read(
  "supabase/migrations/20261002153158_phase8_admin_workflows.sql",
);
for (const rpc of [
  "phase8_update_company_settings",
  "phase8_save_schedule",
  "phase8_set_schedule_active",
  "phase8_save_holiday",
  "phase8_delete_holiday",
  "phase8_save_leave_type",
  "phase8_set_leave_type_active",
  "phase8_audit_search",
]) {
  requireText(workflows, `public.${rpc}`, `Phase 8 migration RPC ${rpc}`);
}
requireText(workflows, "security invoker", "Phase 8 SECURITY INVOKER boundary");
requireText(workflows, "private.is_super_admin()", "Phase 8 Super Admin authorization");
requireText(workflows, "Request-generated schedules", "Schedule workflow-history protection");
requireText(workflows, "Past holidays are retained", "Past holiday protection");
requireText(workflows, "At least one active leave type", "Active leave-type floor");
requireText(workflows, "app.phase8_reason", "Admin audit reason propagation");

const types = read("src/types/database.ts");
requireText(types, "is_test_account: boolean", "Audit environment generated type");
for (const rpc of [
  "phase8_update_company_settings",
  "phase8_save_schedule",
  "phase8_save_holiday",
  "phase8_save_leave_type",
  "phase8_audit_search",
]) {
  requireText(types, rpc, `Generated database type ${rpc}`);
}

const scheduleFields = read("src/components/admin/admin-schedule-fields.tsx");
requireText(scheduleFields, '"use client"', "Schedule field client boundary");
requireText(scheduleFields, "flexible_core", "Flexible-core schedule fields");

const holidayFields = read("src/components/admin/admin-holiday-scope-fields.tsx");
requireText(holidayFields, '"use client"', "Holiday scope client boundary");
requireText(holidayFields, "Company-wide holiday", "Holiday company-wide toggle");

const shell = read("src/components/layout/app-shell.tsx");
requireText(shell, "Phases 1–8 are live", "Phase 8 app status");

const packageJson = read("package.json");
requireText(packageJson, '"phase8:check"', "Phase 8 npm regression gate");

const ci = read(".github/workflows/ci.yml");
requireText(ci, "Phase 8 admin verification", "Phase 8 CI step");
requireText(ci, "npm run phase8:check", "Phase 8 CI command");

console.log("Phase 8 Audit Log & Administrative Settings verification passed.");
