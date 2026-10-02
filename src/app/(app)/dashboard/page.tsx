import Link from "next/link";
import { PageHead } from "@/components/shared/prototype";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { requireRole } from "@/lib/auth/current-profile";
import {
  currentDateFor,
  formatDuration,
  getLiveTeam,
} from "@/lib/data/attendance";
import { getScrumBoard } from "@/lib/data/management";
import { getPendingApprovalCount } from "@/lib/data/requests";
import { TEAM_ROLES } from "@/lib/navigation";

const statusMeta = {
  active: ["Active", "--active"],
  idle: ["Idle", "--idle"],
  away: ["Away", "--away"],
  on_break: ["On break", "--break"],
  in_meeting: ["In meeting", "--meeting"],
  offline: ["Not signed in", "--offline"],
  workday_ended: ["Signed off", "--ended"],
  on_leave: ["On leave", "--break"],
} as const;

function timeNow(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

export default async function DashboardPage() {
  const current = await requireRole(TEAM_ROLES);
  const workDate = currentDateFor(current.timezone);
  const [team, pendingRequestCount, scrum] = await Promise.all([
    getLiveTeam(current),
    getPendingApprovalCount(current),
    getScrumBoard(current, workDate),
  ]);

  const activeScrums = scrum.filter(
    (row) => row.scrumStatus === "signed_in" || row.scrumStatus === "reopened",
  ).length;
  const scrumRows = scrum.filter((row) => row.items.length > 0);
  const scrumProgress = scrumRows.length
    ? Math.round(
        scrumRows.reduce((sum, row) => sum + row.averageProgress, 0) /
          scrumRows.length,
      )
    : 0;
  const openBlockers = scrum.reduce(
    (sum, row) => sum + row.openObstacles,
    0,
  );

  const count = (status: keyof typeof statusMeta) =>
    team.filter((row) => row.presenceStatus === status).length;

  const cards = [
    ["People", team.length, "--fg", ""],
    ["Active", count("active"), "--active", "active"],
    ["Idle", count("idle"), "--idle", "idle"],
    ["Away", count("away"), "--away", "away"],
    ["On break", count("on_break"), "--break", "on_break"],
    ["In meeting", count("in_meeting"), "--meeting", "in_meeting"],
    ["Not signed in", count("offline"), "--offline", "offline"],
    ["Signed off", count("workday_ended"), "--ended", "workday_ended"],
    ["On leave", count("on_leave"), "--break", "on_leave"],
  ] as const;

  const departments = Array.from(
    team.reduce((map, row) => {
      const list = map.get(row.department) ?? [];
      list.push(row);
      map.set(row.department, list);
      return map;
    }, new Map<string, typeof team>()),
  ).sort(([a], [b]) => a.localeCompare(b));

  const expectedMissing = team.filter((row) => row.expectedMissing);
  const flexibleWaiting = team.filter(
    (row) =>
      !row.firstSignInAt &&
      !row.expectedMissing &&
      row.presenceStatus !== "on_leave" &&
      row.scheduleType === "flexible",
  ).length;

  const hours = team
    .filter((row) => row.firstSignInAt && row.scheduledMinutes > 0)
    .sort(
      (a, b) =>
        a.netWorkMinutes / a.scheduledMinutes -
        b.netWorkMinutes / b.scheduledMinutes,
    )
    .slice(0, 6);

  return (
    <>
      <RealtimeRefresh
        tables={[
          "employee_presence",
          "workdays",
          "requests",
          "request_approvals",
          "scrum_entries",
          "scrum_items",
          "scrum_entry_items",
          "scrum_item_progress",
          "scrum_obstacles",
        ]}
      />

      <PageHead
        title="Dashboard"
        subtitle={`${timeNow(current.timezone)} · ${current.timezone}`}
      />

      <div className="presence-stats-grid" style={{ marginBottom: 16 }}>
        {cards.map(([label, value, color, status]) => (
          <Link
            className="stat"
            href={status ? `/live-view?status=${status}` : "/live-view"}
            key={label}
          >
            <span className="l">
              <i className="dot" style={{ background: `var(${color})` }} />
              {label}
            </span>
            <div className="n">{value}</div>
          </Link>
        ))}
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="hd">
            <h2>Departments</h2>
            <Link href="/live-view" className="mut dashboard-link">
              Live view
            </Link>
          </div>

          <div className="bd">
            {departments.map(([name, rows]) => (
              <div className="department-presence" key={name}>
                <div className="department-presence-head">
                  <span>{name}</span>
                  <span className="mut">
                    {
                      rows.filter(
                        (row) =>
                          row.workdayStatus &&
                          row.workdayStatus !== "signed_off" &&
                          row.workdayStatus !== "not_started",
                      ).length
                    }{" "}
                    of {rows.length} working
                  </span>
                </div>
                <div className="bar department-presence-bar">
                  {Object.entries(statusMeta).map(([status, meta]) => {
                    const total = rows.filter(
                      (row) => row.presenceStatus === status,
                    ).length;
                    if (!total) return null;

                    return (
                      <i
                        key={status}
                        title={`${meta[0]}: ${total}`}
                        style={{
                          width: `${(total / rows.length) * 100}%`,
                          background: `var(${meta[1]})`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {departments.length === 0 ? (
              <p className="mut">No employees in your reporting scope.</p>
            ) : null}
          </div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <div className="hd">
              <h2>Requests waiting for you</h2>
            </div>
            <div className="bd">
              <div className="phase-value">{pendingRequestCount}</div>
              <p className="mut phase-copy">
                {pendingRequestCount === 1
                  ? "One request is waiting for your decision."
                  : pendingRequestCount > 1
                    ? pendingRequestCount + " requests are waiting for your decision."
                    : "No requests are waiting for your decision."}
              </p>
              <Link href="/requests#approvals" className="mut dashboard-link">
                Review requests
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="hd">
              <h2>Scrum monitoring</h2>
              <Link href="/scrum-board" className="mut dashboard-link">
                Scrum board
              </Link>
            </div>
            <div className="bd">
              <div className="phase-value">{scrumProgress}%</div>
              <p className="mut phase-copy">
                {activeScrums} active Scrum {activeScrums === 1 ? "cycle" : "cycles"}
                {" · "}
                {openBlockers} open {openBlockers === 1 ? "blocker" : "blockers"}.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="hd">
            <h2>Expected but not signed in</h2>
          </div>
          <div className="bd">
            <ul className="list">
              {expectedMissing.map((row) => (
                <li className="dashboard-expected-row" key={row.employeeId}>
                  <span>
                    <strong>{row.fullName}</strong>
                    <small className="mut">{row.department}</small>
                  </span>
                  <span className="attendance-late">Past grace period</span>
                </li>
              ))}
              {expectedMissing.length === 0 ? (
                <li className="mut">
                  Everyone with a fixed shift or core hours is within policy.
                </li>
              ) : null}
            </ul>

            {flexibleWaiting > 0 ? (
              <p className="mut dashboard-flex-note">
                {flexibleWaiting} flexible{" "}
                {flexibleWaiting === 1 ? "employee has" : "employees have"} not
                signed in yet. Flexible schedules are not marked late.
              </p>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="hd">
            <h2>Hours against target</h2>
            <Link href="/attendance" className="mut dashboard-link">
              Attendance
            </Link>
          </div>
          <div className="bd">
            <ul className="list">
              {hours.map((row) => {
                const percent = Math.min(
                  100,
                  Math.round(
                    (row.netWorkMinutes / row.scheduledMinutes) * 100,
                  ),
                );

                return (
                  <li className="dashboard-hours-row" key={row.employeeId}>
                    <span className="dashboard-hours-copy">
                      <strong>{row.fullName}</strong>
                      <small className="mut">{row.scheduleName}</small>
                      <span className="bar dashboard-hours-bar">
                        <i
                          style={{
                            width: `${percent}%`,
                            background: "var(--cyan)",
                          }}
                        />
                      </span>
                    </span>
                    <span className="mut">
                      {formatDuration(row.netWorkMinutes)} of{" "}
                      {formatDuration(row.scheduledMinutes)}
                    </span>
                  </li>
                );
              })}

              {hours.length === 0 ? (
                <li className="mut">No signed-in workdays yet.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
