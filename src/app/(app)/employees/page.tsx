import Link from "next/link";
import { requireRole } from "@/lib/auth/current-profile";
import { TEAM_ROLES, roleLabel } from "@/lib/navigation";
import { getEmployeeDirectory } from "@/lib/data/organization";
import { Avatar, PageHead, StatusPill } from "@/components/shared/prototype";

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

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireRole(TEAM_ROLES);
  const params = await searchParams;
  const query = (single(params.q) ?? "").trim().toLowerCase();
  const department = single(params.department) ?? "";
  const role = single(params.role) ?? "";
  const status = single(params.status) ?? "";

  const employees = await getEmployeeDirectory(current);
  const departments = Array.from(
    new Set(employees.map((employee) => employee.department)),
  ).sort();

  const filtered = employees.filter((employee) => {
    const matchesQuery =
      !query ||
      employee.fullName.toLowerCase().includes(query) ||
      employee.employeeCode.toLowerCase().includes(query) ||
      employee.email.toLowerCase().includes(query) ||
      employee.jobTitle.toLowerCase().includes(query);

    return (
      matchesQuery &&
      (!department || employee.department === department) &&
      (!role || employee.role === role) &&
      (!status || employee.employmentStatus === status)
    );
  });

  return (
    <>
      <PageHead
        title="Employees"
        subtitle={
          current.is_test_account
            ? "Live demo organization from Supabase"
            : "People, reporting lines and schedules"
        }
        actions={
          current.role === "super_admin" ? (
            <Link className="btn pri" href="/employees/new">
              Add employee
            </Link>
          ) : undefined
        }
      />

      <form className="filters" action="/employees">
        <input
          type="text"
          name="q"
          defaultValue={single(params.q) ?? ""}
          placeholder="Search employees"
        />

        <select name="department" defaultValue={department}>
          <option value="">All departments</option>
          {departments.map((name) => (
            <option value={name} key={name}>
              {name}
            </option>
          ))}
        </select>

        <select name="role" defaultValue={role}>
          <option value="">All roles</option>
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="director">Director</option>
          <option value="super_admin">Super Admin</option>
        </select>

        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On leave</option>
          <option value="deactivated">Deactivated</option>
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
              <th>Role</th>
              <th>Department</th>
              <th>Reports to</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((employee) => (
              <tr className="click" key={employee.id}>
                <td>
                  <Link className="employee-link" href={`/employees/${employee.id}`}>
                    <span className="who">
                      <Avatar initials={initials(employee.fullName)} size={30} />
                      <span>
                        {employee.fullName}
                        <small>
                          {employee.employeeCode} · {employee.jobTitle}
                        </small>
                      </span>
                    </span>
                  </Link>
                </td>
                <td>{roleLabel(employee.role)}</td>
                <td>{employee.department}</td>
                <td>{employee.managerName ?? "—"}</td>
                <td className="mut">{employee.scheduleName ?? "Not assigned"}</td>
                <td>
                  {employee.employmentStatus === "active" ? (
                    <StatusPill label="Active" tone="active" />
                  ) : employee.employmentStatus === "on_leave" ? (
                    <StatusPill label="On leave" tone="break" />
                  ) : (
                    <StatusPill label="Deactivated" tone="ended" />
                  )}
                </td>
                <td>
                  <span className={employee.authLinked ? "access-ok" : "access-pending"}>
                    {employee.authLinked ? "Login ready" : "Login not created"}
                  </span>
                </td>
              </tr>
            ))}

            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="mut">
                  No employees match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="preview-note">
        {filtered.length} of {employees.length} accessible employee profiles.
        Demo and production profiles are isolated from each other.
      </p>
    </>
  );
}
