import Link from "next/link";
import {
  Avatar,
  PageHead,
  StatusPill,
} from "@/components/shared/prototype";
import { AttendanceTimeline } from "@/components/attendance/timeline-strip";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { requireRole } from "@/lib/auth/current-profile";
import { getLiveTeam, formatDuration } from "@/lib/data/attendance";
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

function formatTime(iso: string | null, timeZone: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60_000),
  );
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function presencePill(status: string) {
  switch (status) {
    case "active":
      return <StatusPill label="Active" tone="active" />;
    case "idle":
      return <StatusPill label="Idle" tone="idle" />;
    case "away":
      return <StatusPill label="Away" tone="away" />;
    case "on_break":
      return <StatusPill label="On break" tone="break" />;
    case "in_meeting":
      return <StatusPill label="In meeting" tone="meeting" />;
    case "workday_ended":
      return <StatusPill label="Signed off" tone="ended" />;
    case "on_leave":
      return <StatusPill label="On leave" tone="break" />;
    default:
      return <StatusPill label="Not signed in" tone="offline" />;
  }
}

export default async function LiveViewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireRole(TEAM_ROLES);
  const params = await searchParams;
  const status = single(params.status) ?? "";
  const department = single(params.department) ?? "";

  const team = await getLiveTeam(current);
  const departments = Array.from(
    new Set(team.map((row) => row.department)),
  ).sort();

  const rows = team.filter(
    (row) =>
      (!status || row.presenceStatus === status) &&
      (!department || row.department === department),
  );

  return (
    <>
      <RealtimeRefresh tables={["employee_presence", "workdays"]} />

      <PageHead
        title="Live view"
        subtitle="Updates automatically. Presence describes activity inside the EMS tab only."
        actions={<StatusPill label="Live" tone="active" />}
      />

      <form className="filters" action="/live-view">
        <select name="status" defaultValue={status} aria-label="Status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="idle">Idle</option>
          <option value="away">Away</option>
          <option value="on_break">On break</option>
          <option value="in_meeting">In meeting</option>
          <option value="offline">Not signed in</option>
          <option value="workday_ended">Signed off</option>
          <option value="on_leave">On leave</option>
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
          Filter
        </button>
      </form>

      <div className="card tbl">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th className="hide-sm">Department</th>
              <th>Signed in</th>
              <th className="hide-sm">Last activity</th>
              <th style={{ minWidth: 180 }}>Today</th>
              <th className="num">Worked / target</th>
              <th className="num hide-sm">Breaks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="click" key={row.employeeId}>
                <td>
                  <Link
                    className="employee-link"
                    href={`/employees/${row.employeeId}`}
                  >
                    <span className="who">
                      <Avatar initials={initials(row.fullName)} size={30} />
                      <span>
                        {row.fullName}
                        <small>{row.jobTitle}</small>
                      </span>
                    </span>
                  </Link>
                </td>
                <td>{presencePill(row.presenceStatus)}</td>
                <td className="hide-sm mut">{row.department}</td>
                <td className="num">
                  {formatTime(row.firstSignInAt, row.timezone)}
                  {row.lateMinutes > 0 ? (
                    <span className="attendance-late">
                      {" "}
                      {row.lateMinutes}m late
                    </span>
                  ) : null}
                </td>
                <td className="hide-sm mut">
                  {relativeTime(row.lastActivityAt)}
                </td>
                <td>
                  <AttendanceTimeline row={row} />
                </td>
                <td className="num">
                  {row.firstSignInAt
                    ? `${formatDuration(row.netWorkMinutes)} of ${formatDuration(
                        row.scheduledMinutes,
                      )}`
                    : "—"}
                </td>
                <td className="num hide-sm">
                  {row.firstSignInAt
                    ? formatDuration(row.breakMinutes)
                    : "—"}
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="mut attendance-empty">
                  No one matches these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="legend attendance-legend">
        <span>
          <i className="dot" style={{ background: "var(--active)" }} />
          Active work
        </span>
        <span>
          <i className="dot" style={{ background: "var(--break)" }} />
          Break
        </span>
        <span>
          <i className="dot" style={{ background: "var(--meeting)" }} />
          Meeting
        </span>
      </div>

      <p className="preview-note">
        Active, idle and away are based only on activity inside the EMS tab.
        Meetings count toward worked time; breaks do not.
      </p>
    </>
  );
}
