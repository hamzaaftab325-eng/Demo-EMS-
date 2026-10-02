import Link from "next/link";
import { PageHead, StatusPill } from "@/components/shared/prototype";
import { requireRole } from "@/lib/auth/current-profile";
import {
  currentDateFor,
  formatDuration,
} from "@/lib/data/attendance";
import { getManagementReport } from "@/lib/data/management";
import { TEAM_ROLES } from "@/lib/navigation";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined) {
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

function formatTime(value: string | null, timeZone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function requestTypeLabel(value: string) {
  if (value === "leave") return "Leave";
  if (value === "shift_change") return "Shift change";
  return "Hour change";
}

function requestStatusPill(status: string) {
  if (status === "approved") return <StatusPill label="Approved" tone="active" />;
  if (status === "rejected") return <StatusPill label="Rejected" tone="red" />;
  if (status === "cancelled") return <StatusPill label="Cancelled" tone="ended" />;
  if (status === "pending_final") {
    return <StatusPill label="Final review" tone="meeting" />;
  }
  if (status === "pending_manager") {
    return <StatusPill label="Manager review" tone="idle" />;
  }
  return <StatusPill label="Draft" tone="offline" />;
}

function attendanceLabel(status: string | null) {
  if (!status) return "Not calculated";
  return status.replaceAll("_", " ");
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireRole(TEAM_ROLES);
  const params = await searchParams;
  const today = currentDateFor(current.timezone);
  let end = validDate(single(params.end)) ?? today;
  let start = validDate(single(params.start)) ?? shiftDate(end, -6);
  let rangeClamped = false;

  if (start > end) {
    start = shiftDate(end, -6);
  }

  if (rangeDays(start, end) > 90) {
    start = shiftDate(end, -89);
    rangeClamped = true;
  }

  const employeeId = single(params.employee) ?? "";
  const department = single(params.department) ?? "";
  const attendance = single(params.attendance) ?? "";
  const requestStatus = single(params.request_status) ?? "";
  const query = (single(params.q) ?? "").trim().toLowerCase();

  const report = await getManagementReport(current, start, end);
  const departments = Array.from(
    new Set(report.employees.map((employee) => employee.department)),
  ).sort();

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

  const totalNet = dailyRows.reduce((sum, row) => sum + row.netWorkMinutes, 0);
  const totalTarget = dailyRows.reduce(
    (sum, row) => sum + row.scheduledMinutes,
    0,
  );
  const lateDays = dailyRows.filter((row) => row.lateMinutes > 0).length;
  const overtime = dailyRows.reduce(
    (sum, row) => sum + row.overtimeMinutes,
    0,
  );
  const scrumRows = dailyRows.filter((row) => row.taskCount > 0);
  const avgProgress = scrumRows.length
    ? Math.round(
        scrumRows.reduce((sum, row) => sum + row.averageProgress, 0) /
          scrumRows.length,
      )
    : 0;
  const openBlockers = dailyRows.reduce(
    (sum, row) => sum + row.openObstacles,
    0,
  );
  const approvedRequests = requestRows.filter(
    (row) => row.status === "approved",
  ).length;
  const pendingRequests = requestRows.filter(
    (row) => row.status === "pending_manager" || row.status === "pending_final",
  ).length;

  const exportParams = new URLSearchParams({
    start,
    end,
  });
  if (employeeId) exportParams.set("employee", employeeId);
  if (department) exportParams.set("department", department);
  if (attendance) exportParams.set("attendance", attendance);
  if (requestStatus) exportParams.set("request_status", requestStatus);
  if (query) exportParams.set("q", query);

  const attendanceExport = new URLSearchParams(exportParams);
  attendanceExport.set("type", "attendance");
  const scrumExport = new URLSearchParams(exportParams);
  scrumExport.set("type", "scrum");
  const requestExport = new URLSearchParams(exportParams);
  requestExport.set("type", "requests");

  return (
    <>
      <PageHead
        title="Reports"
        subtitle={`${start} → ${end} · scoped management reporting`}
        actions={
          <div className="phase7-report-actions">
            <Link className="btn" href={`/reports/export?${attendanceExport}`}>
              Attendance CSV
            </Link>
            <Link className="btn" href={`/reports/export?${scrumExport}`}>
              Scrum CSV
            </Link>
            <Link className="btn" href={`/reports/export?${requestExport}`}>
              Requests CSV
            </Link>
          </div>
        }
      />

      {rangeClamped ? (
        <div className="request-notice" role="status">
          Report ranges are limited to 90 days for predictable performance.
          The start date was adjusted automatically.
        </div>
      ) : null}

      <form className="filters phase7-report-filters" action="/reports">
        <input type="date" name="start" defaultValue={start} aria-label="Start date" />
        <input type="date" name="end" defaultValue={end} aria-label="End date" />
        <input
          className="filter-search"
          type="search"
          name="q"
          defaultValue={single(params.q) ?? ""}
          placeholder="Search employee or request"
          aria-label="Search reports"
        />
        <select name="employee" defaultValue={employeeId} aria-label="Employee">
          <option value="">All employees</option>
          {report.employees.map((employee) => (
            <option value={employee.id} key={employee.id}>
              {employee.fullName}
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
        <select
          name="attendance"
          defaultValue={attendance}
          aria-label="Attendance status"
        >
          <option value="">All attendance</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="absent">Absent</option>
          <option value="on_leave">On leave</option>
          <option value="partial">Partial</option>
          <option value="missing_sign_off">Missing sign-off</option>
          <option value="holiday">Holiday</option>
          <option value="weekend">Weekend</option>
        </select>
        <select
          name="request_status"
          defaultValue={requestStatus}
          aria-label="Request status"
        >
          <option value="">All request statuses</option>
          <option value="pending_manager">Manager review</option>
          <option value="pending_final">Final review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="btn" type="submit">
          Apply
        </button>
      </form>

      <div className="phase7-stats phase7-report-stats">
        {[
          ["Workday rows", dailyRows.length],
          ["Net hours", formatDuration(totalNet)],
          ["Target hours", formatDuration(totalTarget)],
          ["Late days", lateDays],
          ["Overtime", formatDuration(overtime)],
          ["Avg Scrum", avgProgress + "%"],
          ["Open blockers", openBlockers],
          ["Approved requests", approvedRequests],
          ["Pending requests", pendingRequests],
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <span className="l">{label}</span>
            <div className="n">{value}</div>
          </div>
        ))}
      </div>

      <section className="request-section">
        <div className="request-section-head">
          <div>
            <h2>Attendance & hours</h2>
            <p className="mut">
              Official workday calculations from the same records used by Phase 5.
            </p>
          </div>
          <span className="request-count">{dailyRows.length}</span>
        </div>
        <div className="card tbl phase7-report-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Status</th>
                <th>Sign in</th>
                <th>Sign off</th>
                <th className="num">Net</th>
                <th className="num">Target</th>
                <th className="num hide-sm">Break</th>
                <th className="num hide-sm">Meetings</th>
                <th className="num">Late</th>
                <th className="num">OT</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={row.employeeId + row.workDate}>
                  <td>{row.workDate}</td>
                  <td>
                    <strong>{row.fullName}</strong>
                    <small>{row.employeeCode} · {row.department}</small>
                  </td>
                  <td className="phase7-capitalize">
                    {attendanceLabel(row.attendanceStatus)}
                  </td>
                  <td>{formatTime(row.firstSignInAt, row.timezone)}</td>
                  <td>{formatTime(row.finalSignOffAt, row.timezone)}</td>
                  <td className="num">{formatDuration(row.netWorkMinutes)}</td>
                  <td className="num">{formatDuration(row.scheduledMinutes)}</td>
                  <td className="num hide-sm">{formatDuration(row.breakMinutes)}</td>
                  <td className="num hide-sm">{formatDuration(row.meetingMinutes)}</td>
                  <td className="num">{row.lateMinutes}m</td>
                  <td className="num">{formatDuration(row.overtimeMinutes)}</td>
                </tr>
              ))}
              {dailyRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="mut attendance-empty">
                    No attendance rows match this report range and filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="request-section">
        <div className="request-section-head">
          <div>
            <h2>Scrum productivity</h2>
            <p className="mut">
              Task completion and blockers from the original Phase 4 Scrum records.
            </p>
          </div>
          <span className="request-count">{scrumRows.length}</span>
        </div>
        <div className="card tbl phase7-report-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Scrum state</th>
                <th className="num">Tasks</th>
                <th className="num">Completed</th>
                <th className="num">Avg progress</th>
                <th className="num">Open blockers</th>
              </tr>
            </thead>
            <tbody>
              {scrumRows.map((row) => (
                <tr key={"scrum-" + row.employeeId + row.workDate}>
                  <td>{row.workDate}</td>
                  <td>
                    <strong>{row.fullName}</strong>
                    <small>{row.department}</small>
                  </td>
                  <td className="phase7-capitalize">
                    {row.scrumStatus.replaceAll("_", " ")}
                  </td>
                  <td className="num">{row.taskCount}</td>
                  <td className="num">{row.completedTasks}</td>
                  <td className="num">{row.averageProgress}%</td>
                  <td className="num">{row.openObstacles}</td>
                </tr>
              ))}
              {scrumRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="mut attendance-empty">
                    No Scrum activity matches this range and filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="request-section">
        <div className="request-section-head">
          <div>
            <h2>Leave & requests</h2>
            <p className="mut">
              Leave, shift changes and hour changes that overlap this report range.
            </p>
          </div>
          <span className="request-count">{requestRows.length}</span>
        </div>
        <div className="card tbl phase7-report-table">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Status</th>
                <th className="num">Leave days</th>
              </tr>
            </thead>
            <tbody>
              {requestRows.map((row) => (
                <tr key={row.id}>
                  <td>#{row.requestNumber}</td>
                  <td>
                    <strong>{row.fullName}</strong>
                    <small>{row.employeeCode} · {row.department}</small>
                  </td>
                  <td>{requestTypeLabel(row.requestType)}</td>
                  <td>
                    {row.startDate === row.endDate
                      ? row.startDate
                      : row.startDate + " → " + row.endDate}
                  </td>
                  <td>{requestStatusPill(row.status)}</td>
                  <td className="num">{row.leaveDays ?? "—"}</td>
                </tr>
              ))}
              {requestRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="mut attendance-empty">
                    No requests overlap this range and filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
