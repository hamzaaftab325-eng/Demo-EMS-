import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required Phase 6 file: ${path}`);
  }
  return fs.readFileSync(path, "utf8");
}

function requireText(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label}: expected ${JSON.stringify(needle)}`);
  }
}

const actions = read("src/app/(app)/requests/actions.ts");
for (const rpc of [
  "request_submit_leave",
  "request_submit_schedule_change",
  "request_cancel",
  "request_decide",
  "request_reassign_approver",
]) {
  requireText(actions, `rpc("${rpc}"`, `Request action ${rpc}`);
}
requireText(actions, 'revalidatePath("/notifications")', "Notification refresh");
requireText(actions, 'revalidatePath("/attendance")', "Attendance refresh after request changes");

const page = read("src/app/(app)/requests/page.tsx");
for (const marker of [
  "Leave request",
  "Shift change",
  "Hour change",
  "Requests waiting for you",
  "Organization approval queue",
  "My request history",
  "Cancel request",
  "Leave balance",
]) {
  requireText(page, marker, `Requests UI ${marker}`);
}
requireText(page, "reassignRequestApprover", "Super Admin reassignment UI");
requireText(page, "RequestTrail", "Audited approval trail");
requireText(page, 'RealtimeRefresh tables={["requests", "request_approvals"]}', "Realtime request refresh");
requireText(page, "request-history-filters", "Request history filters");
requireText(page, 'role="alert"', "Accessible request error notice");
requireText(page, 'id="focused-request"', "Focused notification request");
requireText(page, "formatDateTime", "Request workflow timestamps");
requireText(page, "ShiftDateFields", "Permanent shift date UX");
requireText(page, "RequestSubmitButton", "Pending request action buttons");

const data = read("src/lib/data/requests.ts");
requireText(data, "getPendingApprovalCount", "Dashboard pending approval count");
requireText(data, "managerAncestors", "Hierarchy-aware reassignment candidates");
requireText(data, "remainingDays", "Leave balance view");
requireText(data, ".eq(\"approver_id\", profile.id)", "Approver-scoped queue");
requireText(data, "focusedRequestId", "RLS-scoped linked request lookup");
requireText(data, "focusedRequest:", "Linked request result");

const dashboard = read("src/app/(app)/dashboard/page.tsx");
requireText(dashboard, "getPendingApprovalCount", "Dashboard Phase 6 count");
requireText(dashboard, 'href="/requests#approvals"', "Dashboard approvals link");

const notifications = read("src/app/(app)/notifications/page.tsx");
requireText(notifications, "Mark all read", "Notification center bulk read");
requireText(notifications, "markNotificationRead", "Notification center single read");
requireText(notifications, "openRequestNotification", "Notification exact-request open");
requireText(notifications, "RequestSubmitButton", "Notification pending actions");

const shell = read("src/components/layout/app-shell.tsx");
requireText(shell, 'href="/notifications"', "Notification bell");
requireText(shell, "unreadNotifications", "Unread notification badge");
requireText(shell, 'RealtimeRefresh tables={["notifications"]}', "Global notification realtime refresh");

const realtime = read("src/components/realtime/realtime-refresh.tsx");
requireText(realtime, '"requests"', "Request realtime table");
requireText(realtime, '"request_approvals"', "Approval realtime table");
requireText(realtime, '"notifications"', "Notification realtime table");

const submitButton = read("src/components/requests/request-submit-button.tsx");
requireText(submitButton, "useFormStatus", "Server action pending state");
requireText(submitButton, "window.confirm", "Sensitive action confirmation");
requireText(submitButton, "disabled={pending}", "Duplicate-click prevention");

const shiftFields = read("src/components/requests/shift-date-fields.tsx");
requireText(shiftFields, "Ongoing schedule", "Permanent shift no-end-date UX");

const core = read("supabase/migrations/20261001063943_phase6_requests_approvals_core.sql");
for (const marker of [
  "alter table public.requests",
  "alter table public.schedule_change_details",
  "public.requests%rowtype",
  "public.leave_request_details",
  "public.schedule_change_details",
  "public.request_approvals",
  "public.leave_ledger",
  "public.notifications",
  "request_submit_leave",
  "request_submit_schedule_change",
  "request_cancel",
  "request_decide",
]) {
  requireText(core, marker, `Phase 6 core ${marker}`);
}

const hardening = read("supabase/migrations/20261001101146_phase6_completion_hardening.sql");
for (const marker of [
  "request_assert_leave_balance",
  "request_sync_approved_leave_workdays",
  "block_signin_on_approved_leave",
  "request_apply_schedule_change",
  "same_profile_environment",
  "request_reassign_approver",
  "leave_ledger_request_year_effect_unique",
  "workdays_enforce_approved_leave",
]) {
  requireText(hardening, marker, `Phase 6 hardening ${marker}`);
}
requireText(hardening, "revoke all on public.requests from authenticated", "Protected request writes");
requireText(hardening, "grant select on public.requests to authenticated", "Scoped request reads");
requireText(hardening, "grant update (is_read, read_at) on public.notifications to authenticated", "Notification read-state write scope");

const wrappers = read("supabase/migrations/20261001102627_phase6_rpc_wrapper_hardening.sql");
requireText(wrappers, "security invoker", "Public RPC wrapper security");
for (const impl of [
  "request_submit_leave_impl",
  "request_submit_schedule_change_impl",
  "request_cancel_impl",
  "request_decide_impl",
  "request_reassign_approver_impl",
]) {
  requireText(wrappers, impl, `Private workflow implementation ${impl}`);
}
requireText(wrappers, "from public, anon", "Anonymous RPC execution revoked");

const crossYear = read("supabase/migrations/20261001174317_phase6_cross_year_leave_ledger_fix.sql");
requireText(crossYear, "drop index if exists public.leave_ledger_approved_request_uidx", "Obsolete single-request ledger index removed");
requireText(crossYear, "leave_ledger_request_year_effect_unique", "Cross-year ledger idempotency index");

console.log("Phase 6 Requests & Approvals verification passed.");
