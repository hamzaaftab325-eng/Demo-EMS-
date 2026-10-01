import { notFound } from "next/navigation";
import { PageHead, StatusPill } from "@/components/shared/prototype";
import { EmployeeForm } from "@/components/employees/employee-form";
import {
  sendEmployeeInvite,
  updateEmployee,
} from "@/app/(app)/employees/actions";
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
  const invite = single(query.invite);

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
      {invite === "sent" ? (
        <div className="form-success">
          Login invitation sent. The employee can now open the email and choose
          their password.
        </div>
      ) : null}
      {invite === "resent" ? (
        <div className="form-success">
          A new password setup link was sent to the employee.
        </div>
      ) : null}
      {invite === "already_active" ? (
        <div className="form-success">This employee login is already active.</div>
      ) : null}
      {invite === "demo_address" ? (
        <div className="form-error">
          The employee profile was saved, but @example.test addresses cannot
          receive email. Use a deliverable company mailbox to test activation.
        </div>
      ) : null}
      {invite === "demo_email_not_authorized" ? (
        <div className="form-error">
          The employee profile was saved, but Supabase&apos;s demo email sender
          only delivers to addresses that are members of this Supabase
          organization. Add the test mailbox to the Supabase team or configure
          custom SMTP.
        </div>
      ) : null}
      {invite === "failed" ? (
        <div className="form-error">
          The employee profile was saved, but the setup email could not be
          sent. You can retry from System access.
        </div>
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
              <div className="employee-access-head">
                <span
                  className={
                    employee.authActivatedAt
                      ? "access-ok"
                      : employee.authLinked
                        ? "access-invited"
                        : "access-pending"
                  }
                >
                  {employee.authActivatedAt
                    ? "Login active"
                    : employee.authLinked
                      ? "Activation pending"
                      : "No login yet"}
                </span>
              </div>

              <p className="mut employee-access-copy">
                {employee.authActivatedAt
                  ? "The employee has completed account setup and can sign in with their own password."
                  : employee.authLinked
                    ? "The Auth account exists, but password setup has not been completed yet."
                    : "No Auth identity is linked yet. Send an invitation to create one securely."}
              </p>

              {employee.authInvitedAt ? (
                <p className="mut employee-access-time">
                  Last setup email: {new Date(employee.authInvitedAt).toLocaleString("en-US", {
                    timeZone: current.timezone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : null}

              {employee.email.endsWith("@example.test") &&
              !employee.authActivatedAt ? (
                <div className="employee-access-warning">
                  <b>Demo email</b>
                  <span>
                    @example.test cannot receive a real email. Change this
                    profile to a deliverable company mailbox before testing the
                    invitation email.
                  </span>
                </div>
              ) : null}

              {canEdit && !employee.authActivatedAt ? (
                <form action={sendEmployeeInvite} className="employee-access-action">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <button className="btn brand" type="submit">
                    {employee.authLinked
                      ? "Resend setup link"
                      : "Send login invitation"}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
