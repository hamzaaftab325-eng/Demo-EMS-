import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required Phase 7 file: ${path}`);
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

const dashboard = read("src/app/(app)/dashboard/page.tsx");
requireText(dashboard, "getScrumBoard", "Dashboard Scrum summary");
requireText(dashboard, "getPendingApprovalCount", "Dashboard approvals");
requireText(dashboard, '"scrum_item_progress"', "Dashboard realtime Scrum progress");
forbidText(dashboard, "Phase 7", "Dashboard placeholder removal");

const scrum = read("src/app/(app)/scrum-board/page.tsx");
requireText(scrum, "getScrumBoard", "Scrum Board scoped data");
requireText(scrum, "Assign Scrum work", "Manager task UI");
requireText(scrum, "Current Scrum items", "Scrum item presentation");
requireText(scrum, "Blockers", "Blocker presentation");
requireText(scrum, "Manager-assigned backlog", "Manager backlog presentation");
requireText(scrum, "resolveScrumObstacle", "Blocker resolution action");
requireText(scrum, "scrum_item_progress", "Scrum Board realtime progress");
forbidText(scrum, "PhaseNotice", "Scrum Board placeholder removal");

const actions = read("src/app/(app)/scrum-board/actions.ts");
requireText(actions, 'rpc("phase7_assign_scrum_task"', "Manager assignment RPC");
requireText(actions, 'rpc("phase7_resolve_scrum_obstacle"', "Blocker resolution RPC");
forbidText(actions, '.from("scrum_items").insert', "No direct Scrum item writes");
forbidText(actions, '.from("scrum_obstacles").update', "No direct blocker writes");

const management = read("src/lib/data/management.ts");
requireText(management, "getEmployeeDirectory", "Hierarchy-scoped employee source");
requireText(management, "employee.id !== profile.id", "Exclude manager self");
for (const table of [
  "workdays",
  "scrum_entries",
  "scrum_entry_items",
  "scrum_items",
  "scrum_item_progress",
  "scrum_obstacles",
  "requests",
  "leave_request_details",
]) {
  requireText(management, `.from("${table}")`, `Management data ${table}`);
}
requireText(management, "getManagementReport", "Management report data");
requireText(management, "averageProgress", "Scrum progress calculation");

const reports = read("src/app/(app)/reports/page.tsx");
requireText(reports, "Attendance & hours", "Attendance report section");
requireText(reports, "Scrum productivity", "Scrum report section");
requireText(reports, "Leave & requests", "Request report section");
requireText(reports, "90 days", "Report range safety");
requireText(reports, "/reports/export?", "Report CSV links");
forbidText(reports, "PhaseNotice", "Reports placeholder removal");

const exportRoute = read("src/app/(app)/reports/export/route.ts");
requireText(exportRoute, "getCurrentAccess", "Report export authentication");
requireText(exportRoute, 'profile.role === "employee"', "Report export role guard");
requireText(exportRoute, "getManagementReport", "Scoped report export source");
requireText(exportRoute, 'type === "scrum"', "Scrum CSV export");
requireText(exportRoute, 'type === "requests"', "Requests CSV export");
requireText(exportRoute, "ems-", "CSV filename");

const realtime = read("src/components/realtime/realtime-refresh.tsx");
for (const table of [
  "scrum_entries",
  "scrum_items",
  "scrum_entry_items",
  "scrum_item_progress",
  "scrum_obstacles",
]) {
  requireText(realtime, `"${table}"`, `Realtime type ${table}`);
}

const rpcTypes = read("src/types/database.ts");
requireText(rpcTypes, "phase7_assign_scrum_task", "Phase 7 assignment type");
requireText(rpcTypes, "phase7_resolve_scrum_obstacle", "Phase 7 blocker type");

const realtimeMigration = read(
  "supabase/migrations/20261002145034_phase7_scrum_realtime.sql",
);
requireText(
  realtimeMigration,
  "scrum_entry_items",
  "Realtime publication entry items",
);
requireText(
  realtimeMigration,
  "scrum_item_progress",
  "Realtime publication progress",
);

const workflowMigration = read(
  "supabase/migrations/20261002145952_phase7_management_scrum_workflows.sql",
);
requireText(workflowMigration, "security invoker", "Phase 7 RPC security invoker");
requireText(workflowMigration, "private.can_manage_employee", "Manager scope validation");
requireText(workflowMigration, "app.phase4_workflow", "Protected workflow activation");
requireText(
  workflowMigration,
  "revoke all on function public.phase7_assign_scrum_task",
  "Phase 7 assignment execute boundary",
);

const resetMigration = read(
  "supabase/migrations/20261002150136_phase7_workflow_guard_reset.sql",
);
requireText(
  resetMigration,
  "set_config('app.phase4_workflow', 'off', true)",
  "Phase 7 workflow guard reset",
);
requireText(resetMigration, "exception when others", "Workflow guard error cleanup");

const shell = read("src/components/layout/app-shell.tsx");
requireText(shell, "Phases 1–", "EMS phase status banner");

const packageJson = read("package.json");
requireText(packageJson, '"phase7:check"', "Phase 7 npm regression gate");

const ci = read(".github/workflows/ci.yml");
requireText(ci, "Phase 7 management verification", "Phase 7 CI step");
requireText(ci, "npm run phase7:check", "Phase 7 CI command");

console.log("Phase 7 Management Dashboard, Scrum Board & Reports verification passed.");
