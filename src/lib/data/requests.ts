import type { CurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type RequestDbRow = Database["public"]["Tables"]["requests"]["Row"];
type LeaveDetailDbRow =
  Database["public"]["Tables"]["leave_request_details"]["Row"];
type ScheduleDetailDbRow =
  Database["public"]["Tables"]["schedule_change_details"]["Row"];
type ApprovalDbRow =
  Database["public"]["Tables"]["request_approvals"]["Row"];
type LedgerDbRow = Database["public"]["Tables"]["leave_ledger"]["Row"];
type RequestType = Database["public"]["Enums"]["request_type"];
type RequestStatus = Database["public"]["Enums"]["request_status"];
type ApprovalStage = Database["public"]["Enums"]["approval_stage"];
type ApprovalDecision = Database["public"]["Enums"]["approval_decision"];
type AppRole = Database["public"]["Enums"]["app_role"];

export type RequestApprovalView = {
  id: string;
  stage: ApprovalStage;
  decision: ApprovalDecision;
  approverId: string;
  approverName: string;
  comment: string | null;
  decidedAt: string | null;
};

export type RequestView = {
  id: string;
  requestNumber: number;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  requestType: RequestType;
  startDate: string;
  endDate: string;
  reason: string | null;
  cancellationReason: string | null;
  status: RequestStatus;
  currentStage: ApprovalStage | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  leave: {
    leaveTypeId: string;
    leaveTypeName: string;
    daysRequested: number;
  } | null;
  schedule: {
    newStartTime: string;
    newEndTime: string;
    isPermanent: boolean;
    appliedAt: string | null;
  } | null;
  approvals: RequestApprovalView[];
};

export type LeaveTypeOption = {
  id: string;
  code: string;
  name: string;
  defaultAnnualDays: number | null;
};

export type LeaveBalanceView = LeaveTypeOption & {
  ledgerBalance: number;
  usedDays: number;
  remainingDays: number | null;
  entitlementSource: "allocation" | "default" | "unlimited";
};

export type ApproverCandidate = {
  id: string;
  fullName: string;
  role: AppRole;
  manageableEmployeeIds: string[];
};

export type RequestCenter = {
  canSubmit: boolean;
  myRequests: RequestView[];
  pendingApprovals: RequestView[];
  adminPendingRequests: RequestView[];
  leaveTypes: LeaveTypeOption[];
  leaveBalances: LeaveBalanceView[];
  approverCandidates: ApproverCandidate[];
};

function dateInZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return value("year") + "-" + value("month") + "-" + value("day");
}

function uniqueRequests(rows: RequestDbRow[]) {
  const map = new Map<string, RequestDbRow>();
  for (const row of rows) map.set(row.id, row);
  return Array.from(map.values());
}

async function loadRequestViews(
  profile: CurrentProfile,
  requestRows: RequestDbRow[],
  leaveTypes: LeaveTypeOption[],
): Promise<RequestView[]> {
  if (requestRows.length === 0) return [];

  const supabase = await createClient();
  const requestIds = requestRows.map((row) => row.id);

  const [leaveResult, scheduleResult, approvalsResult] = await Promise.all([
    supabase
      .from("leave_request_details")
      .select("*")
      .in("request_id", requestIds),
    supabase
      .from("schedule_change_details")
      .select("*")
      .in("request_id", requestIds),
    supabase
      .from("request_approvals")
      .select("*")
      .in("request_id", requestIds)
      .order("created_at"),
  ]);

  if (leaveResult.error || scheduleResult.error || approvalsResult.error) {
    throw new Error("Could not load request details.");
  }

  const leaveDetails = (leaveResult.data ?? []) as LeaveDetailDbRow[];
  const scheduleDetails = (scheduleResult.data ?? []) as ScheduleDetailDbRow[];
  const approvals = (approvalsResult.data ?? []) as ApprovalDbRow[];

  const profileIds = Array.from(
    new Set([
      ...requestRows.map((row) => row.employee_id),
      ...approvals.map((row) => row.approver_id),
    ]),
  );

  const { data: people, error: peopleError } = await supabase
    .from("profiles")
    .select("id, full_name, employee_code")
    .in("id", profileIds);

  if (peopleError) {
    throw new Error("Could not load request people.");
  }

  const peopleMap = new Map((people ?? []).map((row) => [row.id, row]));
  const leaveTypeMap = new Map(leaveTypes.map((row) => [row.id, row]));
  const leaveMap = new Map(leaveDetails.map((row) => [row.request_id, row]));
  const scheduleMap = new Map(
    scheduleDetails.map((row) => [row.request_id, row]),
  );

  return requestRows
    .map((row) => {
      const leave = leaveMap.get(row.id);
      const schedule = scheduleMap.get(row.id);
      const employee = peopleMap.get(row.employee_id);

      const requestApprovals = approvals
        .filter((approval) => approval.request_id === row.id)
        .map((approval) => ({
          id: approval.id,
          stage: approval.stage,
          decision: approval.decision,
          approverId: approval.approver_id,
          approverName:
            peopleMap.get(approval.approver_id)?.full_name ??
            (approval.stage === "manager" ? "Manager" : "Final approver"),
          comment: approval.comment,
          decidedAt: approval.decided_at,
        }));

      return {
        id: row.id,
        requestNumber: row.request_number,
        employeeId: row.employee_id,
        employeeName:
          employee?.full_name ??
          (row.employee_id === profile.id ? profile.full_name : "Employee"),
        employeeCode:
          employee?.employee_code ??
          (row.employee_id === profile.id ? profile.employee_code : null),
        requestType: row.request_type,
        startDate: row.start_date,
        endDate: row.end_date,
        reason: row.reason,
        cancellationReason: row.cancellation_reason,
        status: row.status,
        currentStage: row.current_stage,
        submittedAt: row.submitted_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        leave: leave
          ? {
              leaveTypeId: leave.leave_type_id,
              leaveTypeName:
                leaveTypeMap.get(leave.leave_type_id)?.name ?? "Leave",
              daysRequested: Number(leave.days_requested),
            }
          : null,
        schedule: schedule
          ? {
              newStartTime: schedule.new_start_time,
              newEndTime: schedule.new_end_time,
              isPermanent: schedule.is_permanent,
              appliedAt: schedule.applied_at,
            }
          : null,
        approvals: requestApprovals,
      } satisfies RequestView;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function managerAncestors(
  employeeId: string,
  managerByEmployee: Map<string, string>,
) {
  const result = new Set<string>();
  let cursor = employeeId;

  for (let depth = 0; depth < 20; depth += 1) {
    const managerId = managerByEmployee.get(cursor);
    if (!managerId || result.has(managerId)) break;
    result.add(managerId);
    cursor = managerId;
  }

  return result;
}

export async function getRequestCenter(
  profile: CurrentProfile,
): Promise<RequestCenter> {
  const supabase = await createClient();
  const today = dateInZone(profile.timezone);

  const [
    ownResult,
    pendingApprovalResult,
    leaveTypeResult,
    ledgerResult,
    managerResult,
  ] = await Promise.all([
    supabase
      .from("requests")
      .select("*")
      .eq("employee_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("request_approvals")
      .select("*")
      .eq("approver_id", profile.id)
      .eq("decision", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("leave_types")
      .select("id, code, name, default_annual_days")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("leave_ledger")
      .select("*")
      .eq("employee_id", profile.id)
      .order("effective_date", { ascending: false }),
    supabase
      .from("reporting_lines")
      .select("manager_id")
      .eq("employee_id", profile.id)
      .eq("is_primary", true)
      .lte("effective_from", today)
      .or("effective_to.is.null,effective_to.gte." + today)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (
    ownResult.error ||
    pendingApprovalResult.error ||
    leaveTypeResult.error ||
    ledgerResult.error ||
    managerResult.error
  ) {
    throw new Error("Could not load requests.");
  }

  const leaveTypes: LeaveTypeOption[] = (leaveTypeResult.data ?? []).map(
    (row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      defaultAnnualDays:
        row.default_annual_days == null
          ? null
          : Number(row.default_annual_days),
    }),
  );

  const pendingRequestIds = Array.from(
    new Set((pendingApprovalResult.data ?? []).map((row) => row.request_id)),
  );

  let approvalRequests: RequestDbRow[] = [];
  if (pendingRequestIds.length > 0) {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .in("id", pendingRequestIds)
      .in("status", ["pending_manager", "pending_final"]);

    if (error) {
      throw new Error("Could not load pending approvals.");
    }

    approvalRequests = data ?? [];
  }

  let adminRequests: RequestDbRow[] = [];
  let approverCandidates: ApproverCandidate[] = [];

  if (profile.role === "super_admin") {
    const [requestsResult, candidatesResult, linesResult] = await Promise.all([
      supabase
        .from("requests")
        .select("*")
        .in("status", ["pending_manager", "pending_final"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("profiles")
        .select(
          "id, full_name, role, is_test_account, is_active, employment_status",
        )
        .eq("is_active", true)
        .neq("employment_status", "deactivated")
        .in("role", ["manager", "director", "super_admin"])
        .order("full_name"),
      supabase
        .from("reporting_lines")
        .select(
          "employee_id, manager_id, effective_from, effective_to, is_primary",
        )
        .eq("is_primary", true)
        .lte("effective_from", today)
        .or("effective_to.is.null,effective_to.gte." + today),
    ]);

    if (requestsResult.error || candidatesResult.error || linesResult.error) {
      throw new Error("Could not load the organization approval queue.");
    }

    adminRequests = requestsResult.data ?? [];

    const managerByEmployee = new Map(
      (linesResult.data ?? []).map((row) => [row.employee_id, row.manager_id]),
    );
    const employeeIds = Array.from(
      new Set(adminRequests.map((row) => row.employee_id)),
    );

    approverCandidates = (candidatesResult.data ?? [])
      .filter((row) => row.is_test_account === profile.is_test_account)
      .map((row) => {
        const manageableEmployeeIds =
          row.role === "super_admin"
            ? employeeIds
            : employeeIds.filter((employeeId) =>
                managerAncestors(employeeId, managerByEmployee).has(row.id),
              );

        return {
          id: row.id,
          fullName: row.full_name,
          role: row.role,
          manageableEmployeeIds,
        };
      });
  }

  const allRows = uniqueRequests([
    ...(ownResult.data ?? []),
    ...approvalRequests,
    ...adminRequests,
  ]);
  const allViews = await loadRequestViews(profile, allRows, leaveTypes);

  const myIds = new Set((ownResult.data ?? []).map((row) => row.id));
  const approvalIds = new Set(approvalRequests.map((row) => row.id));
  const adminIds = new Set(adminRequests.map((row) => row.id));
  const ledger = (ledgerResult.data ?? []) as LedgerDbRow[];

  const year = today.slice(0, 4);
  const yearStart = year + "-01-01";
  const yearEnd = year + "-12-31";

  const leaveBalances = leaveTypes.map((leaveType) => {
    const rows = ledger.filter(
      (row) =>
        row.leave_type_id === leaveType.id &&
        row.effective_date >= yearStart &&
        row.effective_date <= yearEnd,
    );
    const allocationRows = rows.filter(
      (row) => row.transaction_type === "allocation",
    );
    const allocations = allocationRows.reduce(
      (sum, row) => sum + Number(row.days),
      0,
    );
    const delta = rows
      .filter((row) => row.transaction_type !== "allocation")
      .reduce((sum, row) => sum + Number(row.days), 0);
    const usedDays = rows
      .filter((row) => row.transaction_type === "approved_leave")
      .reduce(
        (sum, row) => sum + Math.abs(Math.min(0, Number(row.days))),
        0,
      );

    const base =
      allocationRows.length > 0 ? allocations : leaveType.defaultAnnualDays;

    return {
      ...leaveType,
      ledgerBalance: allocations + delta,
      usedDays,
      remainingDays: base == null ? null : base + delta,
      entitlementSource:
        allocationRows.length > 0
          ? ("allocation" as const)
          : leaveType.defaultAnnualDays == null
            ? ("unlimited" as const)
            : ("default" as const),
    };
  });

  return {
    canSubmit: Boolean(managerResult.data?.manager_id),
    myRequests: allViews.filter((row) => myIds.has(row.id)),
    pendingApprovals: allViews.filter((row) => approvalIds.has(row.id)),
    adminPendingRequests: allViews.filter((row) => adminIds.has(row.id)),
    leaveTypes,
    leaveBalances,
    approverCandidates,
  };
}

export async function getPendingApprovalCount(
  profile: CurrentProfile,
): Promise<number> {
  const supabase = await createClient();

  const { data: approvals, error: approvalError } = await supabase
    .from("request_approvals")
    .select("request_id")
    .eq("approver_id", profile.id)
    .eq("decision", "pending");

  if (approvalError) {
    throw new Error("Could not load pending request approvals.");
  }

  const ids = Array.from(
    new Set((approvals ?? []).map((row) => row.request_id)),
  );

  if (ids.length === 0) return 0;

  const { data: requests, error: requestError } = await supabase
    .from("requests")
    .select("id")
    .in("id", ids)
    .in("status", ["pending_manager", "pending_final"]);

  if (requestError) {
    throw new Error("Could not load pending request approvals.");
  }

  return requests?.length ?? 0;
}
