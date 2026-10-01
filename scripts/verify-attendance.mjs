import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required Phase 5 file: ${path}`);
  }
  return fs.readFileSync(path, "utf8");
}

function requireText(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label}: expected ${JSON.stringify(needle)}`);
  }
}

const heartbeat = read("src/components/presence/presence-heartbeat.tsx");
requireText(heartbeat, 'rpc("presence_heartbeat"', "Presence heartbeat RPC");
for (const eventName of [
  "pointerdown",
  "keydown",
  "input",
  "scroll",
  "focus",
  "visibilitychange",
]) {
  requireText(heartbeat, eventName, "EMS activity tracking");
}
requireText(
  heartbeat,
  "scheduleActivityHeartbeat",
  "Prompt activity heartbeat",
);
requireText(heartbeat, "heartbeat_interval_seconds", "Configurable heartbeat interval");

const attendance = read("src/lib/data/attendance.ts");
requireText(attendance, "presenceWorkdayIds", "Cross-midnight presence workday loading");
requireText(attendance, "selectedByEmployee", "Live workday selection");
requireText(attendance, '"working", "on_break", "in_meeting"', "Open workday continuity");
requireText(attendance, "presenceRow.workday_id === workday.id", "Stale presence isolation");
requireText(attendance, "expectedMissingNow", "Expected sign-in calculation");

const liveView = read("src/app/(app)/live-view/page.tsx");
requireText(liveView, 'RealtimeRefresh tables={["employee_presence", "workdays"]}', "Live View realtime");
requireText(liveView, "statusOptions", "Live View status filters");
requireText(liveView, "department", "Live View department filter");
requireText(liveView, "Search name, ID, role or department", "Live View search");

const attendancePage = read("src/app/(app)/attendance/page.tsx");
requireText(attendancePage, "attendanceFilters", "Attendance status filters");
requireText(attendancePage, "AttendanceCorrectionButton", "Attendance correction UI");
requireText(attendancePage, "/attendance/export?", "Attendance CSV export");

const exportRoute = read("src/app/(app)/attendance/export/route.ts");
requireText(exportRoute, "getAttendanceTeam(profile, date)", "Scoped attendance export");
requireText(exportRoute, "attendanceKey(row)", "Export attendance status");
requireText(exportRoute, "department", "Export department filter");
requireText(exportRoute, "query", "Export search filter");

const core = read("supabase/migrations/20260930182300_phase5_attendance_presence_core.sql");
for (const marker of [
  "effective_presence_status",
  "recalculate_workday",
  "attendance_correct_day",
  "auto_signoff_workday",
  "phase5_presence_maintenance",
  "phase5_daily_attendance_maintenance",
]) {
  requireText(core, marker, `Phase 5 core ${marker}`);
}
requireText(core, "v_net := greatest(0, v_gross - v_break)", "Break deduction");
requireText(core, "v_meeting", "Meeting accounting");
requireText(core, "schedule_type = 'fixed'", "Fixed schedule lateness");
requireText(core, "schedule_type = 'flexible_core'", "Flexible-core lateness");

const cron = read("supabase/migrations/20260930182312_phase5_presence_attendance_cron.sql");
requireText(cron, "ems-phase5-presence-maintenance", "Presence cron");
requireText(cron, "ems-phase5-daily-attendance-maintenance", "Attendance cron");

const crossMidnight = read("supabase/migrations/20261001031741_phase5_cross_midnight_workday_safety.sql");
requireText(crossMidnight, "workdays_one_open_per_employee", "One open workday constraint");
requireText(crossMidnight, "active_workday_id", "Active workday resolver");

const hardening = read("supabase/migrations/20261001170336_phase5_completion_hardening.sql");
requireText(hardening, "workdays_insert_own_or_super", "Correction workday creation policy");
requireText(hardening, "attendance_events_insert_own_or_super", "Correction event policy");
requireText(hardening, "future date", "Future correction guard");
requireText(hardening, "first sign-in time", "Historical creation guard");
requireText(hardening, "Final sign-off time cannot be earlier", "Correction chronology guard");
requireText(hardening, "v_row.work_date < v_local_today", "Stale signed-off presence rollover");

const correctionScope = read("supabase/migrations/20261001170516_phase5_correction_scope_fix.sql");
requireText(correctionScope, "security invoker", "Least-privilege correction RPC");
requireText(correctionScope, "Employee not found.", "RLS-scoped correction target");

const helperLockdown = read("supabase/migrations/20261001170649_phase5_restrict_private_helper_execution.sql");
requireText(helperLockdown, "revoke execute on function private.same_profile_environment", "Private helper lockdown");

console.log("Phase 5 Attendance & Live Presence verification passed.");
