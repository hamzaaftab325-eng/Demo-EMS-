import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/current-profile";
import {
  getEmployeeDirectory,
  type EmployeeRow,
} from "@/lib/data/organization";
import type { Database } from "@/types/database";

type PresenceStatus = Database["public"]["Enums"]["presence_status"];
type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
type WorkdayStatus = Database["public"]["Enums"]["workday_status"];
type ScheduleType = Database["public"]["Enums"]["schedule_type"];
type WorkdayRow = Database["public"]["Tables"]["workdays"]["Row"];
type PresenceRow = Database["public"]["Tables"]["employee_presence"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["work_schedules"]["Row"];
type IntervalRow = Database["public"]["Tables"]["work_intervals"]["Row"];

export type LiveDisplayStatus = PresenceStatus | "on_leave";

export type TeamAttendanceRow = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  jobTitle: string;
  department: string;
  departmentId: string;
  timezone: string;
  employmentStatus: EmployeeRow["employmentStatus"];
  authLinked: boolean;
  workDate: string;
  snapshotAt: string;
  presenceStatus: LiveDisplayStatus;
  tabConnected: boolean;
  lastActivityAt: string | null;
  lastHeartbeatAt: string | null;
  workdayId: string | null;
  workdayStatus: WorkdayStatus | null;
  attendanceStatus: AttendanceStatus | null;
  firstSignInAt: string | null;
  finalSignOffAt: string | null;
  grossMinutes: number;
  breakMinutes: number;
  meetingMinutes: number;
  netWorkMinutes: number;
  scheduledMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  scheduleId: string | null;
  scheduleName: string | null;
  scheduleType: ScheduleType | null;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  coreStartTime: string | null;
  coreEndTime: string | null;
  graceMinutes: number;
  expectedMissing: boolean;
  intervals: Array<{
    id: string;
    intervalType: Database["public"]["Enums"]["interval_type"];
    status: Database["public"]["Enums"]["interval_status"];
    startedAt: string;
    endedAt: string | null;
  }>;
  corrected: boolean;
};

function dateInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function minuteInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value ?? 0,
  );
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );

  return hour * 60 + minute;
}

function clockMinutes(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function scheduleFor(
  employee: EmployeeRow,
  workday: WorkdayRow | undefined,
  schedules: Map<string, ScheduleRow>,
) {
  const id = workday?.schedule_id ?? employee.scheduleId;
  return id ? schedules.get(id) ?? null : null;
}

function expectedMissingNow(
  employee: EmployeeRow,
  workDate: string,
  workday: WorkdayRow | undefined,
  schedule: ScheduleRow | null,
  now: Date,
) {
  if (
    employee.employmentStatus === "on_leave" ||
    workday?.first_sign_in_at ||
    !schedule ||
    dateInZone(now, employee.timezone) !== workDate
  ) {
    return false;
  }

  const expected =
    schedule.schedule_type === "fixed"
      ? clockMinutes(schedule.start_time)
      : schedule.schedule_type === "flexible_core"
        ? clockMinutes(schedule.core_start_time)
        : null;

  if (expected == null) return false;

  return (
    minuteInZone(now, schedule.timezone || employee.timezone) >
    expected + schedule.grace_minutes
  );
}

function mapRow(
  employee: EmployeeRow,
  workDate: string,
  workday: WorkdayRow | undefined,
  presence: PresenceRow | undefined,
  schedule: ScheduleRow | null,
  intervals: IntervalRow[],
  corrected: boolean,
  now: Date,
): TeamAttendanceRow {
  const presenceStatus: LiveDisplayStatus =
    employee.employmentStatus === "on_leave" ||
    workday?.attendance_status === "on_leave"
      ? "on_leave"
      : (presence?.status ?? "offline");

  return {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    jobTitle: employee.jobTitle,
    department: employee.department,
    departmentId: employee.departmentId,
    timezone: employee.timezone,
    employmentStatus: employee.employmentStatus,
    authLinked: employee.authLinked,
    workDate,
    snapshotAt: now.toISOString(),
    presenceStatus,
    tabConnected: presence?.tab_connected ?? false,
    lastActivityAt: presence?.last_activity_at ?? null,
    lastHeartbeatAt: presence?.last_heartbeat_at ?? null,
    workdayId: workday?.id ?? null,
    workdayStatus: workday?.status ?? null,
    attendanceStatus:
      employee.employmentStatus === "on_leave"
        ? "on_leave"
        : (workday?.attendance_status ?? null),
    firstSignInAt: workday?.first_sign_in_at ?? null,
    finalSignOffAt: workday?.final_sign_off_at ?? null,
    grossMinutes: workday?.gross_minutes ?? 0,
    breakMinutes: workday?.break_minutes ?? 0,
    meetingMinutes: workday?.meeting_minutes ?? 0,
    netWorkMinutes: workday?.net_work_minutes ?? 0,
    scheduledMinutes:
      workday?.scheduled_minutes ?? schedule?.daily_target_minutes ?? 0,
    lateMinutes: workday?.late_minutes ?? 0,
    earlyLeaveMinutes: workday?.early_leave_minutes ?? 0,
    overtimeMinutes: workday?.overtime_minutes ?? 0,
    scheduleId: schedule?.id ?? null,
    scheduleName: schedule?.name ?? employee.scheduleName,
    scheduleType: schedule?.schedule_type ?? null,
    scheduleStartTime: schedule?.start_time ?? null,
    scheduleEndTime: schedule?.end_time ?? null,
    coreStartTime: schedule?.core_start_time ?? null,
    coreEndTime: schedule?.core_end_time ?? null,
    graceMinutes: schedule?.grace_minutes ?? 0,
    expectedMissing:
      workday?.attendance_status === "on_leave"
        ? false
        : expectedMissingNow(
            employee,
            workDate,
            workday,
            schedule,
            now,
          ),
    intervals: intervals.map((interval) => ({
      id: interval.id,
      intervalType: interval.interval_type,
      status: interval.status,
      startedAt: interval.started_at,
      endedAt: interval.ended_at,
    })),
    corrected,
  };
}

function teamEmployees(profile: CurrentProfile, employees: EmployeeRow[]) {
  return employees.filter(
    (employee) => employee.id !== profile.id && employee.isActive,
  );
}

export function currentDateFor(timeZone: string) {
  return dateInZone(new Date(), timeZone);
}

export function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;

  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export async function getLiveTeam(
  profile: CurrentProfile,
): Promise<TeamAttendanceRow[]> {
  const supabase = await createClient();
  const employees = teamEmployees(
    profile,
    await getEmployeeDirectory(profile),
  );

  if (employees.length === 0) return [];

  const now = new Date();
  const ids = employees.map((employee) => employee.id);
  const dateByEmployee = new Map(
    employees.map((employee) => [
      employee.id,
      dateInZone(now, employee.timezone),
    ]),
  );
  const dates = Array.from(new Set(dateByEmployee.values()));

  const [
    { data: presence, error: presenceError },
    { data: schedules, error: schedulesError },
    { data: todayWorkdays, error: todayWorkdaysError },
  ] = await Promise.all([
    supabase
      .from("employee_presence")
      .select(
        "employee_id, workday_id, status, last_heartbeat_at, last_activity_at, status_changed_at, tab_connected, updated_at",
      )
      .in("employee_id", ids),
    supabase
      .from("work_schedules")
      .select(
        "id, name, schedule_type, daily_target_minutes, start_time, end_time, core_start_time, core_end_time, grace_minutes, timezone, is_active, created_at, updated_at",
      ),
    supabase
      .from("workdays")
      .select(
        "id, employee_id, work_date, schedule_id, timezone, status, attendance_status, first_sign_in_at, final_sign_off_at, gross_minutes, break_minutes, meeting_minutes, net_work_minutes, scheduled_minutes, late_minutes, early_leave_minutes, overtime_minutes, closed_at, calculated_at, notes, created_at, updated_at",
      )
      .in("employee_id", ids)
      .in("work_date", dates),
  ]);

  if (presenceError || schedulesError || todayWorkdaysError) {
    throw new Error("Could not load live attendance.");
  }

  const presenceRows = presence ?? [];
  const presenceWorkdayIds = Array.from(
    new Set(
      presenceRows
        .map((row) => row.workday_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: presenceWorkdays, error: presenceWorkdaysError } =
    presenceWorkdayIds.length
      ? await supabase
          .from("workdays")
          .select(
            "id, employee_id, work_date, schedule_id, timezone, status, attendance_status, first_sign_in_at, final_sign_off_at, gross_minutes, break_minutes, meeting_minutes, net_work_minutes, scheduled_minutes, late_minutes, early_leave_minutes, overtime_minutes, closed_at, calculated_at, notes, created_at, updated_at",
          )
          .in("id", presenceWorkdayIds)
      : { data: [], error: null };

  if (presenceWorkdaysError) {
    throw new Error("Could not load active workday continuity.");
  }

  const allWorkdays = new Map<string, WorkdayRow>();
  for (const row of [...(todayWorkdays ?? []), ...(presenceWorkdays ?? [])]) {
    allWorkdays.set(row.id, row);
  }

  const todayByEmployee = new Map(
    (todayWorkdays ?? [])
      .filter((row) => dateByEmployee.get(row.employee_id) === row.work_date)
      .map((row) => [row.employee_id, row]),
  );
  const presenceMap = new Map(
    presenceRows.map((row) => [row.employee_id, row]),
  );
  const selectedByEmployee = new Map<string, WorkdayRow>();

  for (const employee of employees) {
    const presenceRow = presenceMap.get(employee.id);
    const presenceWorkday = presenceRow?.workday_id
      ? allWorkdays.get(presenceRow.workday_id)
      : undefined;
    const todayWorkday = todayByEmployee.get(employee.id);

    if (
      presenceWorkday &&
      ["working", "on_break", "in_meeting"].includes(presenceWorkday.status)
    ) {
      selectedByEmployee.set(employee.id, presenceWorkday);
    } else if (todayWorkday) {
      selectedByEmployee.set(employee.id, todayWorkday);
    }
  }

  const workdayIds = Array.from(
    new Set(Array.from(selectedByEmployee.values()).map((row) => row.id)),
  );

  const [
    { data: intervals, error: intervalsError },
    { data: corrections, error: correctionsError },
  ] = await Promise.all([
    workdayIds.length
      ? supabase
          .from("work_intervals")
          .select(
            "id, workday_id, interval_type, status, started_at, ended_at, notes, corrected_by, created_at, updated_at",
          )
          .in("workday_id", workdayIds)
      : Promise.resolve({ data: [], error: null }),
    workdayIds.length
      ? supabase
          .from("attendance_corrections")
          .select("workday_id")
          .in("workday_id", workdayIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (intervalsError || correctionsError) {
    throw new Error("Could not load live attendance details.");
  }

  const scheduleMap = new Map(
    (schedules ?? []).map((row) => [row.id, row]),
  );
  const correctedWorkdays = new Set(
    (corrections ?? []).map((row) => row.workday_id),
  );
  const intervalMap = new Map<string, IntervalRow[]>();

  for (const interval of intervals ?? []) {
    const list = intervalMap.get(interval.workday_id) ?? [];
    list.push(interval);
    intervalMap.set(interval.workday_id, list);
  }

  return employees
    .map((employee) => {
      const today = dateByEmployee.get(employee.id)!;
      const workday = selectedByEmployee.get(employee.id);
      const workDate = workday?.work_date ?? today;
      const presenceRow = presenceMap.get(employee.id);
      const livePresence =
        presenceRow &&
        (
          (workday && presenceRow.workday_id === workday.id) ||
          (!workday && presenceRow.workday_id == null)
        )
          ? presenceRow
          : undefined;
      const schedule = scheduleFor(employee, workday, scheduleMap);

      return mapRow(
        employee,
        workDate,
        workday,
        livePresence,
        schedule,
        workday ? intervalMap.get(workday.id) ?? [] : [],
        workday ? correctedWorkdays.has(workday.id) : false,
        now,
      );
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getAttendanceTeam(
  profile: CurrentProfile,
  workDate: string,
): Promise<TeamAttendanceRow[]> {
  const supabase = await createClient();
  const employees = teamEmployees(
    profile,
    await getEmployeeDirectory(profile),
  );

  if (employees.length === 0) return [];

  const ids = employees.map((employee) => employee.id);
  const [
    { data: workdays, error: workdaysError },
    { data: schedules, error: schedulesError },
  ] = await Promise.all([
    supabase
      .from("workdays")
      .select(
        "id, employee_id, work_date, schedule_id, timezone, status, attendance_status, first_sign_in_at, final_sign_off_at, gross_minutes, break_minutes, meeting_minutes, net_work_minutes, scheduled_minutes, late_minutes, early_leave_minutes, overtime_minutes, closed_at, calculated_at, notes, created_at, updated_at",
      )
      .in("employee_id", ids)
      .eq("work_date", workDate),
    supabase
      .from("work_schedules")
      .select(
        "id, name, schedule_type, daily_target_minutes, start_time, end_time, core_start_time, core_end_time, grace_minutes, timezone, is_active, created_at, updated_at",
      ),
  ]);

  if (workdaysError || schedulesError) {
    throw new Error("Could not load attendance.");
  }

  const rows = workdays ?? [];
  const workdayIds = rows.map((row) => row.id);
  const { data: corrections, error: correctionsError } = workdayIds.length
    ? await supabase
        .from("attendance_corrections")
        .select("workday_id")
        .in("workday_id", workdayIds)
    : { data: [], error: null };

  if (correctionsError) {
    throw new Error("Could not load attendance corrections.");
  }

  const workdayMap = new Map(rows.map((row) => [row.employee_id, row]));
  const scheduleMap = new Map(
    (schedules ?? []).map((row) => [row.id, row]),
  );
  const correctedWorkdays = new Set(
    (corrections ?? []).map((row) => row.workday_id),
  );
  const now = new Date();

  return employees
    .map((employee) => {
      const workday = workdayMap.get(employee.id);
      const schedule = scheduleFor(employee, workday, scheduleMap);

      return mapRow(
        employee,
        workDate,
        workday,
        undefined,
        schedule,
        [],
        workday ? correctedWorkdays.has(workday.id) : false,
        now,
      );
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
