import type { NextRequest } from "next/server";
import { getCurrentAccess } from "@/lib/auth/current-profile";
import {
  currentDateFor,
  formatDuration,
  getAttendanceTeam,
  type TeamAttendanceRow,
} from "@/lib/data/attendance";

function csvCell(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function formatTime(iso: string | null, timeZone: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function attendanceKey(row: TeamAttendanceRow) {
  if (row.attendanceStatus) return row.attendanceStatus;
  return row.firstSignInAt ? "present" : "not_signed_in";
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

  const requested = request.nextUrl.searchParams.get("date");
  const date =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : currentDateFor(profile.timezone);

  const status = request.nextUrl.searchParams.get("status") ?? "";
  const department = request.nextUrl.searchParams.get("department") ?? "";
  const query = (request.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .toLowerCase();

  const rows = (await getAttendanceTeam(profile, date)).filter((row) => {
    const matchesQuery =
      !query ||
      row.fullName.toLowerCase().includes(query) ||
      row.employeeCode.toLowerCase().includes(query) ||
      row.department.toLowerCase().includes(query) ||
      row.jobTitle.toLowerCase().includes(query);

    return (
      matchesQuery &&
      (!status || attendanceKey(row) === status) &&
      (!department || row.department === department)
    );
  });

  const header = [
    "Employee",
    "Employee ID",
    "Department",
    "Status",
    "Schedule",
    "Signed in",
    "Signed off",
    "Break",
    "Meetings",
    "Net",
    "Target",
    "Late minutes",
    "Early leave minutes",
    "Overtime",
    "Corrected",
  ];

  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.fullName,
        row.employeeCode,
        row.department,
        attendanceKey(row),
        row.scheduleName ?? "",
        formatTime(row.firstSignInAt, row.timezone),
        formatTime(row.finalSignOffAt, row.timezone),
        formatDuration(row.breakMinutes),
        formatDuration(row.meetingMinutes),
        formatDuration(row.netWorkMinutes),
        formatDuration(row.scheduledMinutes),
        row.lateMinutes,
        row.earlyLeaveMinutes,
        formatDuration(row.overtimeMinutes),
        row.corrected ? "Yes" : "No",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ems-attendance-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
