import { PageHead } from "@/components/shared/prototype";
import { requireRole } from "@/lib/auth/current-profile";
import { TEAM_ROLES } from "@/lib/navigation";
import {
  getEmployeeDirectory,
  getOrganizationSummary,
} from "@/lib/data/organization";

export default async function DashboardPage() {
  const current = await requireRole(TEAM_ROLES);
  const employees = await getEmployeeDirectory(current);
  const summary = getOrganizationSummary(employees);

  const stats = [
    ["People", summary.total, "--fg"],
    ["Active profiles", summary.active, "--active"],
    ["Directors", summary.directors, "--cyan"],
    ["Managers", summary.managers, "--gold"],
    ["Employees", summary.employees, "--fg"],
    ["On leave", summary.onLeave, "--break"],
    ["Auth linked", summary.linked, "--cyan"],
  ] as const;

  return (
    <>
      <PageHead
        title="Dashboard"
        subtitle={
          current.is_test_account
            ? "Live Phase 3 organization data from Supabase"
            : "Organization overview"
        }
      />

      <div className="grid g7" style={{ marginBottom: 16 }}>
        {stats.map(([label, value, color]) => (
          <div className="stat" key={label}>
            <span className="l">
              <i className="dot" style={{ background: `var(${color})` }} />
              {label}
            </span>
            <div className="n">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="hd">
            <h2>Departments</h2>
            <a href="/employees" className="mut" style={{ fontSize: 13 }}>
              Employees
            </a>
          </div>

          <div className="bd">
            {summary.departments.map((department) => {
              const percent =
                department.total === 0
                  ? 0
                  : Math.round((department.active / department.total) * 100);

              return (
                <div key={department.name} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{department.name}</span>
                    <span className="mut">
                      {department.active} of {department.total} active
                    </span>
                  </div>

                  <div className="bar" style={{ height: 10 }}>
                    <i
                      style={{
                        width: `${percent}%`,
                        background: "var(--active)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <div className="hd">
              <h2>Requests waiting for you</h2>
            </div>
            <div className="bd">
              <div className="phase-value">—</div>
              <p className="mut phase-copy">
                Real request counts are connected in Phase 6.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="hd">
              <h2>Obstacles today</h2>
            </div>
            <div className="bd">
              <div className="phase-value">—</div>
              <p className="mut phase-copy">
                Real scrum obstacles are connected in Phase 4.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="hd">
            <h2>Reporting structure</h2>
          </div>
          <div className="bd">
            <div className="org-flow">
              <span>CEO / Super Admin</span>
              <b>↓</b>
              <span>Director</span>
              <b>↓</b>
              <span>Manager</span>
              <b>↓</b>
              <span>Employees</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="hd">
            <h2>Hours against target</h2>
          </div>
          <div className="bd">
            <div className="phase-value">—</div>
            <p className="mut phase-copy">
              Workday and attendance calculations become live in Phase 5.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
