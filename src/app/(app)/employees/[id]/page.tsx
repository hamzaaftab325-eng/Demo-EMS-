import { notFound } from "next/navigation";
import { PageHead, StatusPill } from "@/components/shared/prototype";
import { EmployeeForm } from "@/components/employees/employee-form";
import { updateEmployee } from "@/app/(app)/employees/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { TEAM_ROLES, roleLabel } from "@/lib/navigation";
import {
  getEmployeeById,
  getOrganizationOptions,
} from "@/lib/data/organization";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireRole(TEAM_ROLES);
  const { id } = await params;
  const [employee, options, query] = await Promise.all([
    getEmployeeById(current, id),
    getOrganizationOptions(current),
    searchParams,
  ]);

  if (!employee) notFound();

  const canEdit = current.role === "super_admin";
  const error = single(query.error);

  return (
    <>
      <PageHead
        title={employee.fullName}
        subtitle={`${employee.employeeCode} · ${employee.jobTitle}`}
        actions={
          employee.employmentStatus === "active" ? (
            <StatusPill label="Active" tone="active" />
          ) : employee.employmentStatus === "on_leave" ? (
            <StatusPill label="On leave" tone="break" />
          ) : (
            <StatusPill label="Deactivated" tone="ended" />
          )
        }
      />

      {single(query.created) ? (
        <div className="form-success">Employee created successfully.</div>
      ) : null}
      {single(query.updated) ? (
        <div className="form-success">Employee updated successfully.</div>
      ) : null}
      {error ? <div className="form-error">{error}</div> : null}

      <div className="grid g3">
        <div>
          {canEdit ? (
            <EmployeeForm
              action={updateEmployee}
              employee={employee}
              departments={options.departments}
              schedules={options.schedules}
              managers={options.managers}
              submitLabel="Save employee"
            />
          ) : (
            <div className="card">
              <div className="bd">
                <dl className="kv">
                  <dt>Email</dt>
                  <dd>{employee.email}</dd>
                  <dt>Role</dt>
                  <dd>{roleLabel(employee.role)}</dd>
                  <dt>Department</dt>
                  <dd>{employee.department}</dd>
                  <dt>Reports to</dt>
                  <dd>{employee.managerName ?? "—"}</dd>
                  <dt>Schedule</dt>
                  <dd>{employee.scheduleName ?? "Not assigned"}</dd>
                  <dt>Employment type</dt>
                  <dd>{employee.employmentType.replace("_", " ")}</dd>
                  <dt>Timezone</dt>
                  <dd>{employee.timezone}</dd>
                  <dt>Hire date</dt>
                  <dd>{employee.hireDate ?? "—"}</dd>
                </dl>
              </div>
            </div>
          )}
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <div className="hd">
              <h2>Organization</h2>
            </div>
            <div className="bd">
              <dl className="kv employee-kv">
                <dt>Role</dt>
                <dd>{roleLabel(employee.role)}</dd>
                <dt>Department</dt>
                <dd>{employee.department}</dd>
                <dt>Manager</dt>
                <dd>{employee.managerName ?? "Top level"}</dd>
                <dt>Schedule</dt>
                <dd>{employee.scheduleName ?? "Not assigned"}</dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="hd">
              <h2>System access</h2>
            </div>
            <div className="bd">
              <p style={{ margin: 0, fontWeight: 600 }}>
                {employee.authLinked
                  ? "Login ready"
                  : "Login not created yet"}
              </p>
              <p className="mut" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
                Employee records remain separate from authentication identities. Creating a demo Auth user with the same email links it to this existing profile automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
