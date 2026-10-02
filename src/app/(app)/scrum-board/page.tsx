import {
  Avatar,
  PageHead,
  StatusPill,
} from "@/components/shared/prototype";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { ManagementSubmitButton } from "@/components/management/management-submit-button";
import { requireRole } from "@/lib/auth/current-profile";
import {
  currentDateFor,
  formatDuration,
} from "@/lib/data/attendance";
import {
  getScrumBoard,
  type ScrumBoardRow,
} from "@/lib/data/management";
import { TEAM_ROLES } from "@/lib/navigation";
import {
  assignManagerScrumTask,
  resolveScrumObstacle,
} from "./actions";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatTime(value: string | null, timeZone: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function scrumStatus(row: ScrumBoardRow) {
  if (row.attendanceStatus === "on_leave") {
    return <StatusPill label="On leave" tone="break" />;
  }

  if (row.scrumStatus === "signed_in" || row.scrumStatus === "reopened") {
    return <StatusPill label="Scrum active" tone="active" />;
  }

  if (row.scrumStatus === "signed_off") {
    return <StatusPill label="Signed off" tone="ended" />;
  }

  if (row.scrumStatus === "draft") {
    return <StatusPill label="Draft" tone="idle" />;
  }

  return <StatusPill label="Not started" tone="offline" />;
}

function matchesState(row: ScrumBoardRow, state: string) {
  if (!state) return true;
  if (state === "blocked") return row.openObstacles > 0;
  if (state === "on_leave") return row.attendanceStatus === "on_leave";
  if (state === "working") {
    return (
      row.workdayStatus === "working" ||
      row.workdayStatus === "on_break" ||
      row.workdayStatus === "in_meeting"
    );
  }
  if (state === "signed_off") return row.workdayStatus === "signed_off";
  if (state === "not_started") {
    return !row.workdayId || row.workdayStatus === "not_started";
  }
  return true;
}

export default async function ScrumBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireRole(TEAM_ROLES);
  const params = await searchParams;
  const date =
    validDate(single(params.date)) ?? currentDateFor(current.timezone);
  const employeeId = single(params.employee) ?? "";
  const department = single(params.department) ?? "";
  const state = single(params.state) ?? "";
  const query = (single(params.q) ?? "").trim().toLowerCase();
  const success = single(params.success);
  const error = single(params.error);

  const allRows = await getScrumBoard(current, date);
  const departments = Array.from(
    new Set(allRows.map((row) => row.department)),
  ).sort();

  const rows = allRows.filter((row) => {
    const searchText = [
      row.fullName,
      row.employeeCode,
      row.department,
      row.jobTitle,
      ...row.items.map((item) => item.title),
      ...row.assignedBacklog.map((item) => item.title),
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!employeeId || row.employeeId === employeeId) &&
      (!department || row.department === department) &&
      matchesState(row, state) &&
      (!query || searchText.includes(query))
    );
  });

  const activeScrums = allRows.filter(
    (row) => row.scrumStatus === "signed_in" || row.scrumStatus === "reopened",
  ).length;
  const signedOff = allRows.filter(
    (row) => row.scrumStatus === "signed_off",
  ).length;
  const progressRows = allRows.filter((row) => row.items.length > 0);
  const averageProgress = progressRows.length
    ? Math.round(
        progressRows.reduce((sum, row) => sum + row.averageProgress, 0) /
          progressRows.length,
      )
    : 0;
  const openBlockers = allRows.reduce(
    (sum, row) => sum + row.openObstacles,
    0,
  );
  const assignedBacklog = allRows.reduce(
    (sum, row) => sum + row.assignedBacklog.length,
    0,
  );

  return (
    <>
      <RealtimeRefresh
        tables={[
          "workdays",
          "scrum_entries",
          "scrum_items",
          "scrum_entry_items",
          "scrum_item_progress",
          "scrum_obstacles",
        ]}
      />

      <PageHead
        title="Scrum board"
        subtitle={`${date} · team progress, blockers and manager-assigned work`}
      />

      {success ? (
        <div className="request-notice request-notice-success" role="status">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="request-notice request-notice-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="phase7-stats">
        {[
          ["Team", allRows.length],
          ["Scrum active", activeScrums],
          ["Signed off", signedOff],
          ["Avg progress", averageProgress + "%"],
          ["Open blockers", openBlockers],
          ["Assigned backlog", assignedBacklog],
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <span className="l">{label}</span>
            <div className="n">{value}</div>
          </div>
        ))}
      </div>

      <div className="card phase7-manager-task">
        <div className="hd">
          <div>
            <h2>Assign Scrum work</h2>
            <p className="mut">
              Adds a manager-owned backlog item. The employee can pull it into
              their active Scrum cycle without duplicating Phase 4 records.
            </p>
          </div>
        </div>
        <form action={assignManagerScrumTask} className="bd phase7-task-form">
          <input type="hidden" name="date" value={date} />
          <label className="f">
            <span>Employee *</span>
            <select
              name="employee_id"
              defaultValue={employeeId}
              required
            >
              <option value="" disabled>
                Select employee
              </option>
              {allRows.map((row) => (
                <option value={row.employeeId} key={row.employeeId}>
                  {row.fullName} · {row.department}
                </option>
              ))}
            </select>
          </label>
          <label className="f">
            <span>Project</span>
            <input name="project_code" placeholder="NZF" />
          </label>
          <label className="f phase7-task-title">
            <span>Task title *</span>
            <input name="title" required placeholder="Prepare homepage QA" />
          </label>
          <label className="f phase7-task-description">
            <span>Description</span>
            <input
              name="description"
              placeholder="Optional context for the employee"
            />
          </label>
          <ManagementSubmitButton
            className="btn pri"
            pendingLabel="Assigning…"
          >
            Assign task
          </ManagementSubmitButton>
        </form>
      </div>

      <form className="filters phase7-filters" action="/scrum-board">
        <input type="date" name="date" defaultValue={date} aria-label="Scrum date" />
        <input
          className="filter-search"
          type="search"
          name="q"
          defaultValue={single(params.q) ?? ""}
          placeholder="Search employee or task"
          aria-label="Search Scrum board"
        />
        <select name="employee" defaultValue={employeeId} aria-label="Employee">
          <option value="">All employees</option>
          {allRows.map((row) => (
            <option value={row.employeeId} key={row.employeeId}>
              {row.fullName}
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
        <select name="state" defaultValue={state} aria-label="Scrum state">
          <option value="">All states</option>
          <option value="working">Working</option>
          <option value="blocked">Blocked</option>
          <option value="signed_off">Signed off</option>
          <option value="not_started">Not started</option>
          <option value="on_leave">On leave</option>
        </select>
        <button className="btn" type="submit">
          Apply
        </button>
      </form>

      <div className="phase7-scrum-list">
        {rows.map((row) => (
          <article className="card phase7-scrum-card" key={row.employeeId}>
            <div className="bd">
              <div className="phase7-scrum-head">
                <span className="who">
                  <Avatar initials={initials(row.fullName)} size={36} />
                  <span>
                    <strong>{row.fullName}</strong>
                    <small>
                      {row.employeeCode} · {row.department} · {row.jobTitle}
                    </small>
                  </span>
                </span>
                {scrumStatus(row)}
              </div>

              <div className="phase7-scrum-meta">
                <span>
                  Sign in <b>{formatTime(row.firstSignInAt, row.timezone)}</b>
                </span>
                <span>
                  Sign off <b>{formatTime(row.finalSignOffAt, row.timezone)}</b>
                </span>
                <span>
                  Net <b>{formatDuration(row.netWorkMinutes)}</b>
                </span>
                <span>
                  Target <b>{formatDuration(row.scheduledMinutes)}</b>
                </span>
                <span>
                  Break <b>{formatDuration(row.breakMinutes)}</b>
                </span>
                <span>
                  Meeting <b>{formatDuration(row.meetingMinutes)}</b>
                </span>
              </div>

              <div className="phase7-progress-summary">
                <div>
                  <strong>{row.averageProgress}% average progress</strong>
                  <span className="mut">
                    {row.completedItems}/{row.items.length} completed
                  </span>
                </div>
                <span className="bar">
                  <i style={{ width: `${row.averageProgress}%` }} />
                </span>
              </div>

              <div className="phase7-scrum-columns">
                <section>
                  <h3>Current Scrum items</h3>
                  <div className="phase7-task-list">
                    {row.items.map((item) => (
                      <div className="phase7-task-row" key={item.entryItemId}>
                        <div>
                          <span className="request-kicker">
                            {item.projectCode ?? "GENERAL"} · {item.source}
                          </span>
                          <strong>{item.title}</strong>
                          {item.signOffNote ? (
                            <small>{item.signOffNote}</small>
                          ) : null}
                        </div>
                        <div className="phase7-task-progress">
                          <b>{item.currentPercent}%</b>
                          <span className="bar">
                            <i style={{ width: `${item.currentPercent}%` }} />
                          </span>
                        </div>
                      </div>
                    ))}
                    {row.items.length === 0 ? (
                      <p className="mut">No Scrum items for this date.</p>
                    ) : null}
                  </div>
                </section>

                <section>
                  <h3>Blockers</h3>
                  <div className="phase7-blocker-list">
                    {row.obstacles.map((obstacle) => (
                      <div
                        className={
                          obstacle.status === "open"
                            ? "phase7-blocker open"
                            : "phase7-blocker"
                        }
                        key={obstacle.id}
                      >
                        <div>
                          <strong>{obstacle.description}</strong>
                          <small>
                            {obstacle.reportedStage.replace("_", " ")} ·{" "}
                            {obstacle.status}
                          </small>
                          {obstacle.resolutionNote ? (
                            <small>{obstacle.resolutionNote}</small>
                          ) : null}
                        </div>
                        {obstacle.status === "open" ? (
                          <form
                            action={resolveScrumObstacle}
                            className="phase7-resolve-form"
                          >
                            <input type="hidden" name="date" value={date} />
                            <input
                              type="hidden"
                              name="obstacle_id"
                              value={obstacle.id}
                            />
                            <input
                              name="resolution_note"
                              placeholder="Resolution note"
                              required
                            />
                            <ManagementSubmitButton
                              pendingLabel="Resolving…"
                              confirmMessage="Mark this blocker as resolved?"
                            >
                              Resolve
                            </ManagementSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    ))}
                    {row.obstacles.length === 0 ? (
                      <p className="mut">No blockers reported.</p>
                    ) : null}
                  </div>
                </section>
              </div>

              {row.assignedBacklog.length > 0 ? (
                <div className="phase7-assigned-backlog">
                  <strong>Manager-assigned backlog</strong>
                  <div>
                    {row.assignedBacklog.map((item) => (
                      <span key={item.id}>
                        {item.projectCode ? item.projectCode + " · " : ""}
                        {item.title}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        ))}

        {rows.length === 0 ? (
          <div className="card">
            <div className="bd request-empty">
              <strong>No team Scrum rows match these filters.</strong>
              <span className="mut">
                Change the date or filters to see another part of your reporting scope.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
