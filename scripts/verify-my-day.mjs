import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required Phase 4 file: ${path}`);
  }
  return fs.readFileSync(path, "utf8");
}

function requireText(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label}: expected ${JSON.stringify(needle)}`);
  }
}

const page = read("src/app/(app)/my-day/page.tsx");
requireText(page, "requireCurrentProfile", "My Day route protection");
requireText(page, "getMyDayState", "My Day state loading");
requireText(page, "RealtimeRefresh", "My Day realtime refresh");
requireText(page, '"workdays"', "My Day workday realtime");
requireText(page, '"employee_presence"', "My Day presence realtime");

const actions = read("src/app/(app)/my-day/actions.ts");
for (const action of [
  "my_day_sign_in",
  "my_day_update_progress",
  "my_day_add_cycle_item",
  "my_day_add_obstacle",
  "my_day_start_interval",
  "my_day_end_interval",
  "my_day_sign_off",
  "my_day_sign_back_in",
]) {
  requireText(actions, action, "My Day server actions");
}
requireText(actions, "requireCurrentProfile", "My Day server identity guard");

const state = read("src/lib/my-day/state.ts");
requireText(state, 'rpc("my_day_get_state")', "My Day canonical state RPC");
requireText(state, 'from("employee_presence")', "My Day live presence");
requireText(state, 'from("workdays")', "My Day attendance totals");
requireText(state, "candidateItems", "My Day backlog/carry-over state");
requireText(state, "previousItems", "My Day previous cycle state");
requireText(state, "attendanceEvents", "My Day event history");
requireText(state, "intervals", "My Day interval history");

const client = read("src/components/my-day/my-day-client.tsx");
requireText(client, "Sign in with your scrum", "My Day sign-in UI");
requireText(client, "previousItems", "Previous Scrum UI");
requireText(client, "candidateItems", "Carry-over/backlog UI");
requireText(client, "updateMyDayProgress", "Progress update UI");
requireText(client, "addMyDayObstacle", "Obstacle UI");
requireText(client, 'startMyDayInterval("break")', "Break action");
requireText(client, 'startMyDayInterval("meeting")', "Meeting action");
requireText(client, "Sign off with your scrum", "Sign-off UI");
requireText(client, "Sign-off note", "Sign-off notes");
requireText(client, "signBackInMyDay", "Sign-back-in UI");
requireText(client, "myday-timeline-card", "My Day timeline");
requireText(client, "disabled={pending}", "Duplicate-click UI guard");

const workflow = read(
  "supabase/migrations/20260930151815_phase4_my_day_scrum_workflows.sql",
);
requireText(
  workflow,
  "work_intervals_one_active_per_workday",
  "One active interval invariant",
);
requireText(workflow, "my_day_sign_in", "Sign-in workflow");
requireText(workflow, "my_day_sign_off", "Sign-off workflow");
requireText(workflow, "my_day_sign_back_in", "Sign-back-in workflow");
requireText(workflow, "carried_from_entry_item_id", "Carry-over lineage");
requireText(workflow, "if v_percent = 100 then", "100 percent completion rule");
requireText(workflow, "status = 'completed'", "Completed item transition");
requireText(workflow, "status = 'active'", "Incomplete item carry-forward transition");
requireText(workflow, "'sign_back_in'", "Sign-back-in attendance event");

const guards = read(
  "supabase/migrations/20260930175926_phase4_enforce_workflow_only_writes_v2.sql",
);
requireText(
  guards,
  "Direct writes are not allowed for this EMS workflow.",
  "Workflow-only write guard",
);
for (const table of [
  "workdays",
  "attendance_events",
  "work_intervals",
  "scrum_entries",
  "scrum_items",
  "scrum_entry_items",
  "scrum_item_progress",
  "scrum_obstacles",
]) {
  requireText(guards, `phase4_guard_${table}`, `Phase 4 guard for ${table}`);
}

const crossMidnight = read(
  "supabase/migrations/20261001031741_phase5_cross_midnight_workday_safety.sql",
);
requireText(
  crossMidnight,
  "workdays_one_open_per_employee",
  "One open workday invariant",
);
requireText(
  crossMidnight,
  "private.active_workday_id",
  "Cross-midnight active workday resolver",
);

console.log("Phase 4 My Day & Scrum verification passed.");
