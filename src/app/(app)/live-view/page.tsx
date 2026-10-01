import Link from "next/link";
import {
  Avatar,
  PageHead,
  StatusPill,
} from "@/components/shared/prototype";
import { AttendanceTimeline } from "@/components/attendance/timeline-strip";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { requireRole } from "@/lib/auth/current-profile";
import {
  getLiveTeam,
  formatDuration,
  type LiveDisplayStatus,
} from "@/lib/data/attendance";
import { TEAM_ROLES } from "@/lib/navigation";

const statusOptions: Array<{
  value: "" | LiveDisplayStatus;
  label: string;
}> = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "idle", label: "Idle" },
  { value: "away", label: "Away" },
  { value: "on_break", label: "On break" },
  { value: "in_meeting", label: "In meeting" },
  { value: "offline", label: "Not signed in" },
  { value: "workday_ended", label: "Signed off" },
  { value: "on_leave", label: "On leave" },
];

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

function relativeTime(iso: string | null, snapshotAt: string) {
  if (!iso) return "—";
  const minutes = Math.max(
    0,
    Math.floor(
      (new Date(snapshotAt).getTime() - new Date(iso).getTime()) / 60_000,
    ),
  );

  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function presencePill(status: LiveDisplayStatus) {
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

function liveHref(input: {
  status?: string;
  department?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.department) params.set("department", input.department);
  if (input.q) params.set("q", input.q);
  const query = params.toString();
  return query ? `/live-view?${query}` : "/live-view";
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
  const query = (single(params.q) ?? "").trim().toLowerCase();

  const team = await getLiveTeam(current);
  const departments = Array.from(
    new Set(team.map((row) => row.department)),
  ).sort();

  const counts = new Map<string, number>();
  for (const option of statusOptions) {
    counts.set(
      option.value,
      option.value
        ? team.filter((row) => row.presenceStatus === option.value).length
        : team.length,
    );
  }

  const rows = team.filter((row) => {
    const matchesQuery =
      !query ||
      row.fullName.toLowerCase().includes(query) ||
      row.employeeCode.toLowerCase().includes(query) ||
      row.jobTitle.toLowerCase().includes(query) ||
      row.department.toLowerCase().includes(query);

    return (
      matchesQuery &&
      (!status || row.presenceStatus === status) &&
      (!department || row.department === department)
    );
  });

  return (
    <>
      <RealtimeRefresh tables={["employee_presence", "workdays"]} />

      <PageHead
        title="Live view"
        subtitle="Realtime team presence from the EMS tab only"
        actions={<StatusPill label="Live" tone="active" />}
      />

      <div className="status-filter-bar" aria-label="Presence filters">
        {statusOptions.map((option) => (
          <Link
            key={option.value || "all"}
            href={liveHref({
              status: option.value,
              department,
              q: query,
            })}
            className={
              status === option.value
                ? "status-filter-chip on"
                : "status-filter-chip"
            }
          >
            <span>{option.label}</span>
            <b>{counts.get(option.value) ?? 0}</b>
          </Link>
        ))}
      </div>

      <form className="filters live-filters" action="/live-view">
        <input
          className="filter-search"
          type="text"
          name="q"
          defaultValue={single(params.q) ?? ""}
          placeholder="Search name, ID, role or department"
          aria-label="Search team"
        />

        <select name="status" defaultValue={status} aria-label="Status">
          {statusOptions.map((option) => (
            <option value={option.value} key={option.value || "all"}>
              {option.value ? option.label : "All statuses"}
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
          <Link className="btn ghost" href="/live-view">
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
              <th className="hide-sm">Department</th>
              <th>Signed in</th>
              <th className="hide-sm">Last EMS activity</th>
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
                        <small>
                          {row.employeeCode} · {row.jobTitle}
                        </small>
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
                  {relativeTime(row.lastActivityAt, row.snapshotAt)}
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
                  No team members match the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="legend attendance-legend">
        {[
          ["Active", "var(--active)"],
          ["Idle", "var(--idle)"],
          ["Away", "var(--away)"],
          ["Break", "var(--break)"],
          ["Meeting", "var(--meeting)"],
          ["Offline", "var(--offline)"],
          ["Signed off", "var(--ended)"],
        ].map(([label, color]) => (
          <span key={label}>
            <i className="dot" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      <p className="preview-note">
        Active, idle and away are calculated from EMS-tab heartbeat and
        interaction timestamps. Meetings count toward worked time; breaks do
        not.
      </p>
    </>
  );
}
