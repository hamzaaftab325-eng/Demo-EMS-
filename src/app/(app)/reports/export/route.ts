import type { NextRequest } from "next/server";
import { getCurrentAccess } from "@/lib/auth/current-profile";
import { currentDateFor, formatDuration } from "@/lib/data/attendance";
import { getManagementReport } from "@/lib/data/management";

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function shiftDate(value: string, days: number) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function rangeDays(start: string, end: string) {
  return Math.floor(
    (new Date(end + "T00:00:00Z").getTime() -
      new Date(start + "T00:00:00Z").getTime()) /
      86_400_000,
  ) + 1;
}

function csvCell(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function formatTime(value: string | null, timeZone: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function GET(request: NextRequest) {
  const access = await getCurrentAccess();
  const profile = access.profile;

  if (!access.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!profile || profile.role === "employee") {
    return new Response("Forbidden", { status: 403 });
  }

  const today = currentDateFor(profile.timezone);
  const end = validDate(request.nextUrl.searchParams.get("end")) ?? today;
  let start =
    validDate(request.nextUrl.searchParams.get("start")) ?? shiftDate(end, -6);

  if (start > end) start = shiftDate(end, -6);
  if (rangeDays(start, end) > 90) start = shiftDate(end, -89);

  const type = request.nextUrl.searchParams.get("type") ?? "attendance";
  const employeeId = request.nextUrl.searchParams.get("employee") ?? "";
  const department = request.nextUrl.searchParams.get("department") ?? "";
  const attendance = request.nextUrl.searchParams.get("attendance") ?? "";
  const requestStatus =
    request.nextUrl.searchParams.get("request_status") ?? "";
  const query = (request.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .toLowerCase();

  const report = await getManagementReport(profile, start, end);

  const dailyRows = report.dailyRows.filter((row) => {
    const searchText = [
      row.fullName,
      row.employeeCode,
      row.department,
      row.workDate,
      row.attendanceStatus ?? "",
      row.scrumStatus,
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!employeeId || row.employeeId === employeeId) &&
      (!department || row.department === department) &&
      (!attendance || row.attendanceStatus === attendance) &&
      (!query || searchText.includes(query))
    );
  });

  const requestRows = report.requestRows.filter((row) => {
    const searchText = [
      String(row.requestNumber),
      row.fullName,
      row.employeeCode,
      row.department,
      row.requestType,
      row.status,
      row.reason ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!employeeId || row.employeeId === employeeId) &&
      (!department || row.department === department) &&
      (!requestStatus || row.status === requestStatus) &&
      (!query || searchText.includes(query))
    );
  });

  let header: string[];
  let lines: string[][];
  let label: string;

  if (type === "scrum") {
    header = [
      "Date",
      "Employee",
      "Employee ID",
      "Department",
      "Scrum status",
      "Tasks",
      "Completed",
      "Average progress",
      "Open blockers",
    ];
    lines = dailyRows
      .filter((row) => row.taskCount > 0)
      .map((row) => [
        row.workDate,
        row.fullName,
        row.employeeCode,
        row.department,
        row.scrumStatus,
        String(row.taskCount),
        String(row.completedTasks),
        row.averageProgress + "%",
        String(row.openObstacles),
      ]);
    label = "scrum";
  } else if (type === "requests") {
    header = [
      "Request",
      "Employee",
      "Employee ID",
      "Department",
      "Type",
      "Start",
      "End",
      "Status",
      "Leave days",
      "Reason",
      "Submitted",
      "Completed",
    ];
    lines = requestRows.map((row) => [
      String(row.requestNumber),
      row.fullName,
      row.employeeCode,
      row.department,
      row.requestType,
      row.startDate,
      row.endDate,
      row.status,
      row.leaveDays == null ? "" : String(row.leaveDays),
      row.reason ?? "",
      row.submittedAt ?? "",
      row.completedAt ?? "",
    ]);
    label = "requests";
  } else {
    header = [
      "Date",
      "Employee",
      "Employee ID",
      "Department",
      "Attendance",
      "Sign in",
      "Sign off",
      "Net",
      "Target",
      "Break",
      "Meeting",
      "Late minutes",
      "Early leave minutes",
      "Overtime",
    ];
    lines = dailyRows.map((row) => [
      row.workDate,
      row.fullName,
      row.employeeCode,
      row.department,
      row.attendanceStatus ?? "",
      formatTime(row.firstSignInAt, row.timezone),
      formatTime(row.finalSignOffAt, row.timezone),
      formatDuration(row.netWorkMinutes),
      formatDuration(row.scheduledMinutes),
      formatDuration(row.breakMinutes),
      formatDuration(row.meetingMinutes),
      String(row.lateMinutes),
      String(row.earlyLeaveMinutes),
      formatDuration(row.overtimeMinutes),
    ]);
    label = "attendance";
  }

  const csv = [
    header.map(csvCell).join(","),
    ...lines.map((line) => line.map(csvCell).join(",")),
  ].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ems-${label}-${start}-to-${end}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
