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
} from "@/lib/data/attendance";
import { TEAM_ROLES } from "@/lib/navigation";

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

function statusPill(status: string | null, hasSignIn: boolean) {
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
      return hasSignIn ? (
        <StatusPill label="Present" tone="active" />
      ) : (
        <StatusPill label="Not signed in" tone="offline" />
      );
  }
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
  const rows = await getAttendanceTeam(current, date);

  return (
    <>
      <RealtimeRefresh tables={["workdays"]} />

      <PageHead
        title="Attendance"
        subtitle={`${date} · real workday calculations`}
        actions={
          <Link
            className="btn"
            href={`/attendance/export?date=${encodeURIComponent(date)}`}
          >
            Export CSV
          </Link>
        }
      />

      <form className="filters" action="/attendance">
        <input
          type="date"
          name="date"
          defaultValue={date}
          aria-label="Attendance date"
        />
        <button className="btn" type="submit">
          View date
        </button>
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
                        <small>{row.department}</small>
                      </span>
                    </span>
                  </Link>
                </td>
                <td>
                  <span className="attendance-status-cell">
                    {statusPill(
                      row.attendanceStatus,
                      Boolean(row.firstSignInAt),
                    )}
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
                  No employees are in your reporting scope.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="preview-note">
        Flexible schedules are measured against their daily target and are
        never marked late. Late applies to fixed shifts and flexible schedules
        with core hours after the configured grace period. Corrections require
        a reason and are written to the audit log.
      </p>
    </>
  );
}
