import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/current-profile";
import {
  getEmployeeDirectory,
  type EmployeeRow,
} from "@/lib/data/organization";
import type { Database } from "@/types/database";

type WorkdayRow = Database["public"]["Tables"]["workdays"]["Row"];
type ScrumEntryRow = Database["public"]["Tables"]["scrum_entries"]["Row"];
type ScrumEntryItemRow =
  Database["public"]["Tables"]["scrum_entry_items"]["Row"];
type ScrumItemRow = Database["public"]["Tables"]["scrum_items"]["Row"];
type ScrumProgressRow =
  Database["public"]["Tables"]["scrum_item_progress"]["Row"];
type ScrumObstacleRow =
  Database["public"]["Tables"]["scrum_obstacles"]["Row"];
type RequestRow = Database["public"]["Tables"]["requests"]["Row"];
type LeaveDetailRow =
  Database["public"]["Tables"]["leave_request_details"]["Row"];

type ScrumItemView = {
  entryItemId: string;
  itemId: string;
  projectCode: string | null;
  title: string;
  description: string | null;
  source: Database["public"]["Enums"]["scrum_item_source"];
  status: Database["public"]["Enums"]["scrum_task_status"];
  startingPercent: number;
  currentPercent: number;
  finalPercent: number | null;
  signOffNote: string | null;
  addedAt: string;
};

export type ManagementObstacleView = {
  id: string;
  description: string;
  status: Database["public"]["Enums"]["obstacle_status"];
  reportedStage: Database["public"]["Enums"]["obstacle_stage"];
  reportedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
};

export type ManagerAssignedTaskView = {
  id: string;
  projectCode: string | null;
  title: string;
  description: string | null;
  status: Database["public"]["Enums"]["scrum_task_status"];
  createdAt: string;
};

export type ScrumBoardRow = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  jobTitle: string;
  departmentId: string;
  department: string;
  timezone: string;
  workDate: string;
  workdayId: string | null;
  workdayStatus: Database["public"]["Enums"]["workday_status"] | null;
  attendanceStatus: Database["public"]["Enums"]["attendance_status"] | null;
  firstSignInAt: string | null;
  finalSignOffAt: string | null;
  netWorkMinutes: number;
  scheduledMinutes: number;
  breakMinutes: number;
  meetingMinutes: number;
  scrumEntryId: string | null;
  scrumStatus: Database["public"]["Enums"]["scrum_entry_status"] | "not_started";
  signedInAt: string | null;
  signedOffAt: string | null;
  items: ScrumItemView[];
  obstacles: ManagementObstacleView[];
  assignedBacklog: ManagerAssignedTaskView[];
  averageProgress: number;
  completedItems: number;
  openObstacles: number;
};

export type ManagementDailyReportRow = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentId: string;
  department: string;
  workDate: string;
  timezone: string;
  attendanceStatus: Database["public"]["Enums"]["attendance_status"] | null;
  workdayStatus: Database["public"]["Enums"]["workday_status"];
  firstSignInAt: string | null;
  finalSignOffAt: string | null;
  netWorkMinutes: number;
  scheduledMinutes: number;
  breakMinutes: number;
  meetingMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  scrumStatus: Database["public"]["Enums"]["scrum_entry_status"] | "not_started";
  taskCount: number;
  completedTasks: number;
  averageProgress: number;
  openObstacles: number;
};

export type ManagementRequestReportRow = {
  id: string;
  requestNumber: number;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentId: string;
  department: string;
  requestType: Database["public"]["Enums"]["request_type"];
  status: Database["public"]["Enums"]["request_status"];
  startDate: string;
  endDate: string;
  reason: string | null;
  leaveDays: number | null;
  submittedAt: string | null;
  completedAt: string | null;
};

export type ManagementReportData = {
  employees: EmployeeRow[];
  dailyRows: ManagementDailyReportRow[];
  requestRows: ManagementRequestReportRow[];
};

function scopedEmployees(profile: CurrentProfile, employees: EmployeeRow[]) {
  return employees.filter(
    (employee) => employee.id !== profile.id && employee.isActive,
  );
}

function latestProgressMap(progress: ScrumProgressRow[]) {
  const map = new Map<string, ScrumProgressRow>();

  for (const row of progress) {
    const current = map.get(row.scrum_entry_item_id);
    if (
      !current ||
      row.recorded_at > current.recorded_at ||
      (row.recorded_at === current.recorded_at && row.id > current.id)
    ) {
      map.set(row.scrum_entry_item_id, row);
    }
  }

  return map;
}

async function loadScrumDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workdays: WorkdayRow[],
  employeeIds: string[],
) {
  const workdayIds = workdays.map((row) => row.id);
  const { data: entries, error: entriesError } = workdayIds.length
    ? await supabase
        .from("scrum_entries")
        .select("*")
        .in("workday_id", workdayIds)
    : { data: [], error: null };

  if (entriesError) {
    throw new Error("Could not load team Scrum entries.");
  }

  const entryRows = (entries ?? []) as ScrumEntryRow[];
  const entryIds = entryRows.map((row) => row.id);

  const [
    { data: entryItems, error: entryItemsError },
    { data: obstacles, error: obstaclesError },
    { data: assigned, error: assignedError },
  ] = await Promise.all([
    entryIds.length
      ? supabase
          .from("scrum_entry_items")
          .select("*")
          .in("scrum_entry_id", entryIds)
          .order("added_at")
      : Promise.resolve({ data: [], error: null }),
    entryIds.length
      ? supabase
          .from("scrum_obstacles")
          .select("*")
          .in("scrum_entry_id", entryIds)
          .order("reported_at")
      : Promise.resolve({ data: [], error: null }),
    employeeIds.length
      ? supabase
          .from("scrum_items")
          .select("*")
          .in("employee_id", employeeIds)
          .eq("source", "manager")
          .in("status", ["backlog", "active"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (entryItemsError || obstaclesError || assignedError) {
    throw new Error("Could not load team Scrum details.");
  }

  const entryItemRows = (entryItems ?? []) as ScrumEntryItemRow[];
  const obstacleRows = (obstacles ?? []) as ScrumObstacleRow[];
  const assignedRows = (assigned ?? []) as ScrumItemRow[];

  const currentItemIds = entryItemRows.map((row) => row.scrum_item_id);
  const allItemIds = Array.from(
    new Set([...currentItemIds, ...assignedRows.map((row) => row.id)]),
  );

  const [
    { data: items, error: itemsError },
    { data: progress, error: progressError },
  ] = await Promise.all([
    allItemIds.length
      ? supabase.from("scrum_items").select("*").in("id", allItemIds)
      : Promise.resolve({ data: [], error: null }),
    entryItemRows.length
      ? supabase
          .from("scrum_item_progress")
          .select("*")
          .in(
            "scrum_entry_item_id",
            entryItemRows.map((row) => row.id),
          )
          .order("recorded_at")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (itemsError || progressError) {
    throw new Error("Could not load Scrum progress.");
  }

  return {
    entries: entryRows,
    entryItems: entryItemRows,
    items: (items ?? []) as ScrumItemRow[],
    progress: (progress ?? []) as ScrumProgressRow[],
    obstacles: obstacleRows,
    assigned: assignedRows,
  };
}

function buildScrumMaps(detail: Awaited<ReturnType<typeof loadScrumDetail>>) {
  const entryByWorkday = new Map(
    detail.entries.map((row) => [row.workday_id, row]),
  );
  const entryItemsByEntry = new Map<string, ScrumEntryItemRow[]>();
  const obstaclesByEntry = new Map<string, ScrumObstacleRow[]>();
  const itemMap = new Map(detail.items.map((row) => [row.id, row]));
  const progressMap = latestProgressMap(detail.progress);
  const linkedItemIds = new Set(detail.entryItems.map((row) => row.scrum_item_id));

  for (const row of detail.entryItems) {
    const list = entryItemsByEntry.get(row.scrum_entry_id) ?? [];
    list.push(row);
    entryItemsByEntry.set(row.scrum_entry_id, list);
  }

  for (const row of detail.obstacles) {
    const list = obstaclesByEntry.get(row.scrum_entry_id) ?? [];
    list.push(row);
    obstaclesByEntry.set(row.scrum_entry_id, list);
  }

  return {
    entryByWorkday,
    entryItemsByEntry,
    obstaclesByEntry,
    itemMap,
    progressMap,
    linkedItemIds,
  };
}

function itemViews(
  entryId: string | null,
  maps: ReturnType<typeof buildScrumMaps>,
) {
  if (!entryId) return [];

  return (maps.entryItemsByEntry.get(entryId) ?? [])
    .map((entryItem) => {
      const item = maps.itemMap.get(entryItem.scrum_item_id);
      if (!item) return null;
      const latest = maps.progressMap.get(entryItem.id);
      const currentPercent =
        latest?.percent ?? entryItem.final_percent ?? entryItem.starting_percent;

      return {
        entryItemId: entryItem.id,
        itemId: item.id,
        projectCode: item.project_code,
        title: item.title,
        description: item.description,
        source: item.source,
        status: item.status,
        startingPercent: entryItem.starting_percent,
        currentPercent,
        finalPercent: entryItem.final_percent,
        signOffNote: entryItem.sign_off_note,
        addedAt: entryItem.added_at,
      } satisfies ScrumItemView;
    })
    .filter((row): row is ScrumItemView => row !== null);
}

function obstacleViews(
  entryId: string | null,
  maps: ReturnType<typeof buildScrumMaps>,
) {
  if (!entryId) return [];

  return (maps.obstaclesByEntry.get(entryId) ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    status: row.status,
    reportedStage: row.reported_stage,
    reportedAt: row.reported_at,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
  }));
}

function averageProgress(items: ScrumItemView[]) {
  if (!items.length) return 0;
  return Math.round(
    items.reduce((sum, item) => sum + item.currentPercent, 0) / items.length,
  );
}

export async function getScrumBoard(
  profile: CurrentProfile,
  workDate: string,
): Promise<ScrumBoardRow[]> {
  const supabase = await createClient();
  const employees = scopedEmployees(
    profile,
    await getEmployeeDirectory(profile),
  );

  if (!employees.length) return [];

  const ids = employees.map((employee) => employee.id);
  const { data: workdays, error: workdaysError } = await supabase
    .from("workdays")
    .select("*")
    .in("employee_id", ids)
    .eq("work_date", workDate);

  if (workdaysError) {
    throw new Error("Could not load team workdays.");
  }

  const workdayRows = (workdays ?? []) as WorkdayRow[];
  const workdayMap = new Map(workdayRows.map((row) => [row.employee_id, row]));
  const detail = await loadScrumDetail(supabase, workdayRows, ids);
  const maps = buildScrumMaps(detail);

  return employees
    .map((employee) => {
      const workday = workdayMap.get(employee.id);
      const entry = workday ? maps.entryByWorkday.get(workday.id) : undefined;
      const items = itemViews(entry?.id ?? null, maps);
      const obstacles = obstacleViews(entry?.id ?? null, maps);
      const assignedBacklog = detail.assigned
        .filter(
          (item) =>
            item.employee_id === employee.id && !maps.linkedItemIds.has(item.id),
        )
        .map((item) => ({
          id: item.id,
          projectCode: item.project_code,
          title: item.title,
          description: item.description,
          status: item.status,
          createdAt: item.created_at,
        }));

      return {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        jobTitle: employee.jobTitle,
        departmentId: employee.departmentId,
        department: employee.department,
        timezone: employee.timezone,
        workDate,
        workdayId: workday?.id ?? null,
        workdayStatus: workday?.status ?? null,
        attendanceStatus: workday?.attendance_status ?? null,
        firstSignInAt: workday?.first_sign_in_at ?? null,
        finalSignOffAt: workday?.final_sign_off_at ?? null,
        netWorkMinutes: workday?.net_work_minutes ?? 0,
        scheduledMinutes: workday?.scheduled_minutes ?? 0,
        breakMinutes: workday?.break_minutes ?? 0,
        meetingMinutes: workday?.meeting_minutes ?? 0,
        scrumEntryId: entry?.id ?? null,
        scrumStatus: (entry?.status ?? "not_started") as ScrumBoardRow["scrumStatus"],
        signedInAt: entry?.signed_in_at ?? null,
        signedOffAt: entry?.signed_off_at ?? null,
        items,
        obstacles,
        assignedBacklog,
        averageProgress: averageProgress(items),
        completedItems: items.filter(
          (item) => item.currentPercent >= 100 || item.status === "completed",
        ).length,
        openObstacles: obstacles.filter((item) => item.status === "open").length,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getManagementReport(
  profile: CurrentProfile,
  startDate: string,
  endDate: string,
): Promise<ManagementReportData> {
  const supabase = await createClient();
  const employees = scopedEmployees(
    profile,
    await getEmployeeDirectory(profile),
  );
  const employeeMap = new Map(employees.map((row) => [row.id, row]));

  if (!employees.length) {
    return { employees, dailyRows: [], requestRows: [] };
  }

  const ids = employees.map((row) => row.id);
  const [
    { data: workdays, error: workdaysError },
    { data: requests, error: requestsError },
  ] = await Promise.all([
    supabase
      .from("workdays")
      .select("*")
      .in("employee_id", ids)
      .gte("work_date", startDate)
      .lte("work_date", endDate)
      .order("work_date", { ascending: false }),
    supabase
      .from("requests")
      .select("*")
      .in("employee_id", ids)
      .lte("start_date", endDate)
      .gte("end_date", startDate)
      .order("created_at", { ascending: false }),
  ]);

  if (workdaysError || requestsError) {
    throw new Error("Could not load management reports.");
  }

  const workdayRows = (workdays ?? []) as WorkdayRow[];
  const requestRows = (requests ?? []) as RequestRow[];
  const detail = await loadScrumDetail(supabase, workdayRows, ids);
  const maps = buildScrumMaps(detail);

  const requestIds = requestRows.map((row) => row.id);
  const { data: leaveDetails, error: leaveError } = requestIds.length
    ? await supabase
        .from("leave_request_details")
        .select("*")
        .in("request_id", requestIds)
    : { data: [], error: null };

  if (leaveError) {
    throw new Error("Could not load leave report details.");
  }

  const leaveMap = new Map(
    ((leaveDetails ?? []) as LeaveDetailRow[]).map((row) => [
      row.request_id,
      row,
    ]),
  );

  const dailyRows: ManagementDailyReportRow[] = workdayRows
    .map((workday) => {
      const employee = employeeMap.get(workday.employee_id);
      if (!employee) return null;
      const entry = maps.entryByWorkday.get(workday.id);
      const items = itemViews(entry?.id ?? null, maps);
      const obstacles = obstacleViews(entry?.id ?? null, maps);

      return {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        departmentId: employee.departmentId,
        department: employee.department,
        workDate: workday.work_date,
        timezone: workday.timezone || employee.timezone,
        attendanceStatus: workday.attendance_status,
        workdayStatus: workday.status,
        firstSignInAt: workday.first_sign_in_at,
        finalSignOffAt: workday.final_sign_off_at,
        netWorkMinutes: workday.net_work_minutes,
        scheduledMinutes: workday.scheduled_minutes,
        breakMinutes: workday.break_minutes,
        meetingMinutes: workday.meeting_minutes,
        lateMinutes: workday.late_minutes,
        earlyLeaveMinutes: workday.early_leave_minutes,
        overtimeMinutes: workday.overtime_minutes,
        scrumStatus: entry?.status ?? "not_started",
        taskCount: items.length,
        completedTasks: items.filter(
          (item) => item.currentPercent >= 100 || item.status === "completed",
        ).length,
        averageProgress: averageProgress(items),
        openObstacles: obstacles.filter((item) => item.status === "open").length,
      };
    })
    .filter((row): row is ManagementDailyReportRow => row !== null);

  const reportRequests: ManagementRequestReportRow[] = requestRows
    .map((request) => {
      const employee = employeeMap.get(request.employee_id);
      if (!employee) return null;
      const leave = leaveMap.get(request.id);

      return {
        id: request.id,
        requestNumber: request.request_number,
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        departmentId: employee.departmentId,
        department: employee.department,
        requestType: request.request_type,
        status: request.status,
        startDate: request.start_date,
        endDate: request.end_date,
        reason: request.reason,
        leaveDays: leave ? Number(leave.days_requested) : null,
        submittedAt: request.submitted_at,
        completedAt: request.completed_at,
      };
    })
    .filter((row): row is ManagementRequestReportRow => row !== null);

  return {
    employees,
    dailyRows,
    requestRows: reportRequests,
  };
}
