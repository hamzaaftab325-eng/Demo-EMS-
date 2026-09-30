import Link from "next/link";
import {
  Avatar,
  PageHead,
  StatusPill,
} from "@/components/shared/prototype";
import { AttendanceCorrectionButton } from "@/components/attendance/attendance-correction-button";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { requireRole } from "@/lib/auth/current-profile";
import {
  currentDateFor,
  formatDuration,
  getAttendanceTeam,
  type TeamAttendanceRow,
} from "@/lib/data/attendance";
import { TEAM_ROLES } from "@/lib/navigation";

const attendanceFilters = [
  ["", "All"],
  ["present", "Present"],
  ["late", "Late"],
  ["absent", "Absent"],
  ["not_signed_in", "Not signed in"],
  ["on_leave", "Leave"],
  ["missing_sign_off", "Missing sign-off"],
  ["holiday", "Holiday"],
  ["weekend", "Weekend"],
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function formatTime(iso: string | null, timeZone: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function inputTime(iso: string | null, timeZone: string) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("hour")}:${value("minute")}`;
}

function attendanceKey(row: TeamAttendanceRow) {
  if (row.attendanceStatus) return row.attendanceStatus;
  return row.firstSignInAt ? "present" : "not_signed_in";
}

function statusPill(status: string) {
  switch (status) {
    case "present":
      return <StatusPill label="Present" tone="active" />;
    case "late":
      return <StatusPill label="Late" tone="idle" />;
    case "absent":
      return <StatusPill label="Absent" tone="red" />;
    case "on_leave":
      return <StatusPill label="Leave" tone="break" />;
    case "partial":
      return <StatusPill label="Partial" tone="idle" />;
    case "holiday":
      return <StatusPill label="Holiday" tone="offline" />;
    case "weekend":
      return <StatusPill label="Weekend" tone="offline" />;
    case "missing_sign_off":
      return <StatusPill label="Missing sign-off" tone="away" />;
    default:
      return <StatusPill label="Not signed in" tone="offline" />;
  }
}

function attendanceHref(input: {
  date: string;
  status?: string;
  department?: string;
  q?: string;
}) {
  const params = new URLSearchParams({ date: input.date });
  if (input.status) params.set("status", input.status);
  if (input.department) params.set("department", input.department);
  if (input.q) params.set("q", input.q);
  return `/attendance?${params.toString()}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireRole(TEAM_ROLES);
  const params = await searchParams;
  const requested = validDate(single(params.date));
  const date = requested ?? currentDateFor(current.timezone);
  const status = single(params.status) ?? "";
  const department = single(params.department) ?? "";
  const query = (single(params.q) ?? "").trim().toLowerCase();

  const allRows = await getAttendanceTeam(current, date);
  const departments = Array.from(
    new Set(allRows.map((row) => row.department)),
  ).sort();

  const counts = new Map<string, number>();
  for (const [value] of attendanceFilters) {
    counts.set(
      value,
      value
        ? allRows.filter((row) => attendanceKey(row) === value).length
        : allRows.length,
    );
  }

  const rows = allRows.filter((row) => {
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

  const exportParams = new URLSearchParams({ date });
  if (status) exportParams.set("status", status);
  if (department) exportParams.set("department", department);
  if (query) exportParams.set("q", query);

  return (
    <>
      <RealtimeRefresh tables={["workdays"]} />

      <PageHead
        title="Attendance"
        subtitle={`${date} · official workday calculations`}
        actions={
          <Link
            className="btn"
            href={`/attendance/export?${exportParams.toString()}`}
          >
            Export CSV
          </Link>
        }
      />

      <div className="status-filter-bar" aria-label="Attendance filters">
        {attendanceFilters.map(([value, label]) => (
          <Link
            key={value || "all"}
            href={attendanceHref({
              date,
              status: value,
              department,
              q: query,
            })}
            className={
              status === value
                ? "status-filter-chip on"
                : "status-filter-chip"
            }
          >
            <span>{label}</span>
            <b>{counts.get(value) ?? 0}</b>
          </Link>
        ))}
      </div>

      <form className="filters attendance-filters" action="/attendance">
        <input
          type="date"
          name="date"
          defaultValue={date}
          aria-label="Attendance date"
        />

        <input
          className="filter-search"
          type="text"
          name="q"
          defaultValue={single(params.q) ?? ""}
          placeholder="Search employee"
          aria-label="Search employees"
        />

        <select name="status" defaultValue={status} aria-label="Attendance status">
          {attendanceFilters.map(([value, label]) => (
            <option value={value} key={value || "all"}>
              {value ? label : "All statuses"}
            </option>
          ))}
        </select>

        <select
          name="department"
          defaultValue={department}
          aria-label="Department"
        >
          <option value="">All departments</option>
          {departments.map((name) => (
            <option value={name} key={name}>
              {name}
            </option>
          ))}
        </select>

        <button className="btn" type="submit">
          Apply
        </button>

        {status || department || query ? (
          <Link className="btn ghost" href={`/attendance?date=${date}`}>
            Reset
          </Link>
        ) : null}
      </form>

      <div className="card tbl">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th className="hide-sm">Schedule</th>
              <th>Signed in</th>
              <th>Signed off</th>
              <th className="num hide-sm">Break</th>
              <th className="num">Net</th>
              <th className="num">Target</th>
              {current.role === "super_admin" ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId}>
                <td>
                  <Link
                    className="employee-link"
                    href={`/employees/${row.employeeId}`}
                  >
                    <span className="who">
                      <Avatar initials={initials(row.fullName)} size={30} />
                      <span>
                        {row.fullName}
                        <small>
                          {row.employeeCode} · {row.department}
                        </small>
                      </span>
                    </span>
                  </Link>
                </td>
                <td>
                  <span className="attendance-status-cell">
                    {statusPill(attendanceKey(row))}
                    {row.corrected ? (
                      <span className="attendance-corrected">Corrected</span>
                    ) : null}
                  </span>
                </td>
                <td className="hide-sm mut">
                  {row.scheduleName ?? "Not assigned"}
                </td>
                <td className="num">
                  {formatTime(row.firstSignInAt, row.timezone)}
                  {row.lateMinutes > 0 ? (
                    <small className="attendance-late-block">
                      {row.lateMinutes}m late
                    </small>
                  ) : null}
                </td>
                <td className="num">
                  {row.finalSignOffAt
                    ? formatTime(row.finalSignOffAt, row.timezone)
                    : row.firstSignInAt
                      ? "Working"
                      : "—"}
                </td>
                <td className="num hide-sm">
                  {row.firstSignInAt
                    ? formatDuration(row.breakMinutes)
                    : "—"}
                </td>
                <td className="num attendance-net">
                  {row.firstSignInAt
                    ? formatDuration(row.netWorkMinutes)
                    : "—"}
                </td>
                <td className="num mut">
                  {formatDuration(row.scheduledMinutes)}
                </td>
                {current.role === "super_admin" ? (
                  <td className="num">
                    <AttendanceCorrectionButton
                      employeeId={row.employeeId}
                      employeeName={row.fullName}
                      workDate={date}
                      timezone={row.timezone}
                      defaultFirstTime={inputTime(
                        row.firstSignInAt,
                        row.timezone,
                      )}
                      defaultFinalTime={inputTime(
                        row.finalSignOffAt,
                        row.timezone,
                      )}
                      defaultBreakMinutes={row.breakMinutes}
                    />
                  </td>
                ) : null}
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={current.role === "super_admin" ? 9 : 8}
                  className="mut attendance-empty"
                >
                  No employees match the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="preview-note">
        Flexible schedules are measured against their daily target and are
        never marked late. Fixed shifts and flexible-core schedules use their
        configured start/core-start plus grace. Corrections require a reason
        and are audited.
      </p>
    </>
  );
}
