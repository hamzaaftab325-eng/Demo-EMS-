import { notFound } from "next/navigation";
import { PageHead, StatusPill } from "@/components/shared/prototype";
import { EmployeeForm } from "@/components/employees/employee-form";
import {
  assignEmployeeWorkEmail,
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
  const [employee, query] = await Promise.all([
    getEmployeeById(current, id),
    searchParams,
  ]);

  if (!employee) notFound();

  const options = await getOrganizationOptions(
    current,
    employee.scheduleId,
  );

  const canEdit = current.role === "super_admin";
  const error = single(query.error);
  const invite = single(query.invite);
  const access = single(query.access);

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
          Account setup invitation sent. The employee can open the email and
          choose their password.
        </div>
      ) : null}
      {invite === "resent" ? (
        <div className="form-success">
          A new account setup invitation was sent. The previous incomplete
          setup link is no longer the active onboarding link.
        </div>
      ) : null}
      {invite === "already_active" ? (
        <div className="form-success">This employee login is already active.</div>
      ) : null}
      {access === "work_email_assigned" ? (
        <div className="form-success">
          Work login email assigned successfully. The employee keeps the same
          password and must use the new work email on their next sign-in.
        </div>
      ) : null}
      {access === "work_email_already_assigned" ? (
        <div className="form-success">
          That work login email is already assigned to this employee.
        </div>
      ) : null}
      {invite === "demo_address" ? (
        <div className="form-error">
          The employee profile was saved, but @example.test addresses cannot
          receive email. Use a deliverable setup mailbox for invitation testing.
        </div>
      ) : null}
      {invite === "demo_email_not_authorized" ? (
        <div className="form-error">
          The employee profile was saved, but the configured email provider
          rejected this recipient. Check the SMTP sender or use a permitted test
          mailbox.
        </div>
      ) : null}
      {invite === "email_rate_limited" ? (
        <div className="form-error">
          The employee profile was saved, but the email provider rate limit was
          reached. Retry from System access after the provider allows another
          message.
        </div>
      ) : null}
      {invite === "failed" ? (
        <div className="form-error">
          The employee profile was saved, but the setup invitation could not be
          sent. Retry from System access or review the Auth email configuration.
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
              isTestEnvironment={current.is_test_account}
            />
          ) : (
            <div className="card">
              <div className="bd">
                <dl className="kv">
                  <dt>Login email</dt>
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
                    ? employee.workEmail || !current.is_test_account
                      ? "Login active"
                      : "Setup complete · work email pending"
                    : employee.authLinked
                      ? "Activation pending"
                      : "No login yet"}
                </span>
              </div>

              <p className="mut employee-access-copy">
                {employee.authActivatedAt
                  ? employee.workEmail || !current.is_test_account
                    ? "The employee can sign in with the current work/login email and the password they created."
                    : "The employee created their password. Assign the final work login email below; the password will remain unchanged."
                  : employee.authLinked
                    ? "The Auth account exists, but password setup has not been completed yet."
                    : "No Auth identity is linked yet. Send an account setup invitation to begin."}
              </p>

              <dl className="kv employee-kv">
                <dt>Current login</dt>
                <dd>{employee.email}</dd>
                {canEdit ? (
                  <>
                    <dt>Setup email</dt>
                    <dd>{employee.personalEmail ?? employee.email}</dd>
                    <dt>Work login</dt>
                    <dd>{employee.workEmail ?? "Not assigned yet"}</dd>
                  </>
                ) : null}
              </dl>

              {employee.authInvitedAt ? (
                <p className="mut employee-access-time">
                  Last setup invitation:{" "}
                  {new Date(employee.authInvitedAt).toLocaleString("en-US", {
                    timeZone: current.timezone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : null}

              {employee.email.endsWith("@example.test") &&
              !employee.authActivatedAt ? (
                <div className="employee-access-warning">
                  <b>Non-deliverable demo address</b>
                  <span>
                    @example.test cannot receive a real invitation. Use a
                    deliverable setup mailbox for email testing.
                  </span>
                </div>
              ) : null}

              {canEdit && !employee.authActivatedAt ? (
                <form action={sendEmployeeInvite} className="employee-access-action">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <button className="btn brand" type="submit">
                    {employee.authLinked
                      ? "Resend account setup"
                      : "Send account setup invitation"}
                  </button>
                </form>
              ) : null}

              {canEdit &&
              employee.authActivatedAt &&
              employee.employmentStatus !== "deactivated" ? (
                <form action={assignEmployeeWorkEmail} className="employee-access-action">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <label className="f">
                    <span>Work login email</span>
                    <input
                      type="email"
                      name="work_email"
                      required
                      defaultValue={employee.workEmail ?? ""}
                      placeholder="name@emarketselect.com"
                    />
                    <small className="mut">
                      {current.is_test_account
                        ? "Demo accounts may use any valid test work email. The employee keeps the password already created."
                        : "Production accounts must use @emarketselect.com. The employee keeps the password already created."}
                    </small>
                  </label>
                  <button className="btn brand" type="submit">
                    {employee.workEmail
                      ? "Change work login email"
                      : "Assign work login email"}
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
