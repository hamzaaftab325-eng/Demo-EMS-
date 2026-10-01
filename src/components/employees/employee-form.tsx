import Link from "next/link";
import type { EmsRole } from "@/lib/navigation";
import type {
  DepartmentOption,
  EmployeeRow,
  ManagerOption,
  ScheduleOption,
} from "@/lib/data/organization";

type FormAction = (formData: FormData) => Promise<void>;

function roleName(role: EmsRole) {
  if (role === "super_admin") return "Super Admin";
  if (role === "director") return "Director";
  if (role === "manager") return "Manager";
  return "Employee";
}

export function EmployeeForm({
  action,
  employee,
  departments,
  schedules,
  managers,
  submitLabel,
  isTestEnvironment = false,
}: {
  action: FormAction;
  employee?: EmployeeRow | null;
  departments: DepartmentOption[];
  schedules: ScheduleOption[];
  managers: ManagerOption[];
  submitLabel: string;
  isTestEnvironment?: boolean;
}) {
  return (
    <form action={action} className="card">
      <div className="bd">
        {employee ? (
          <>
            <input type="hidden" name="employee_id" value={employee.id} />
            <input type="hidden" name="email" value={employee.email} />
          </>
        ) : null}

        <div className="employee-form-grid">
          <label className="f">
            <span>Employee code *</span>
            <input
              name="employee_code"
              type="text"
              required
              defaultValue={employee?.employeeCode ?? ""}
              placeholder="EMS-DEMO-008"
            />
          </label>

          {employee ? (
            <>
              <label className="f">
                <span>Current login email</span>
                <input
                  type="email"
                  value={employee.email}
                  disabled
                  aria-describedby="employee-login-email-help"
                />
                <small id="employee-login-email-help" className="mut">
                  Change a linked login identity only from System access.
                </small>
              </label>

              <label className="f">
                <span>Setup email *</span>
                <input
                  name="personal_email"
                  type="email"
                  required
                  defaultValue={employee.personalEmail ?? employee.email}
                  placeholder="employee@example.com"
                />
                <small className="mut">
                  Initial onboarding contact retained separately from the work login.
                </small>
              </label>
            </>
          ) : (
            <>
              <label className="f">
                <span>Setup email *</span>
                <input
                  name="personal_email"
                  type="email"
                  required
                  placeholder="employee@example.com"
                />
                <small className="mut">
                  Receives the first EMS account setup invitation.
                </small>
              </label>

              <label className="f">
                <span>
                  Work login email{isTestEnvironment ? "" : " *"}
                </span>
                <input
                  name="work_email"
                  type="email"
                  required={!isTestEnvironment}
                  placeholder="name@emarketselect.com"
                />
                <small className="mut">
                  {isTestEnvironment
                    ? "Optional for demo testing. Leave blank to activate with the setup email first, then assign the work login from System access."
                    : "Required in production and must use @emarketselect.com."}
                </small>
              </label>
            </>
          )}

          <label className="f">
            <span>Full name *</span>
            <input
              name="full_name"
              type="text"
              required
              defaultValue={employee?.fullName ?? ""}
            />
          </label>

          <label className="f">
            <span>Job title *</span>
            <input
              name="job_title"
              type="text"
              required
              defaultValue={employee?.jobTitle ?? ""}
            />
          </label>

          <label className="f">
            <span>Department *</span>
            <select
              name="department_id"
              required
              defaultValue={employee?.departmentId ?? ""}
            >
              <option value="" disabled>
                Select department
              </option>
              {departments.map((department) => (
                <option value={department.id} key={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className="f">
            <span>Employment type *</span>
            <select
              name="employment_type"
              required
              defaultValue={employee?.employmentType ?? "full_time"}
            >
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </label>

          <label className="f">
            <span>Role *</span>
            <select name="role" required defaultValue={employee?.role ?? "employee"}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="director">Director</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>

          <label className="f">
            <span>Reports to</span>
            <select
              name="manager_id"
              defaultValue={employee?.managerId ?? ""}
            >
              <option value="">No manager</option>
              {managers
                .filter((manager) => manager.id !== employee?.id)
                .map((manager) => (
                  <option value={manager.id} key={manager.id}>
                    {manager.fullName} · {roleName(manager.role)}
                  </option>
                ))}
            </select>
          </label>

          <label className="f">
            <span>Work schedule</span>
            <select
              name="schedule_id"
              defaultValue={employee?.scheduleId ?? ""}
            >
              <option value="">No schedule</option>
              {schedules.map((schedule) => (
                <option value={schedule.id} key={schedule.id}>
                  {schedule.name}
                </option>
              ))}
            </select>
          </label>

          <label className="f">
            <span>Timezone *</span>
            <input
              name="timezone"
              type="text"
              required
              defaultValue={employee?.timezone ?? "Asia/Karachi"}
            />
          </label>

          <label className="f">
            <span>Hire date</span>
            <input
              name="hire_date"
              type="date"
              defaultValue={employee?.hireDate ?? ""}
            />
          </label>

          {employee ? (
            <label className="f">
              <span>Employment status *</span>
              <select
                name="employment_status"
                required
                defaultValue={employee.employmentStatus}
              >
                <option value="active">Active</option>
                <option value="on_leave">On leave</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </label>
          ) : null}
        </div>

        {!employee ? (
          <label className="employee-invite-option">
            <input
              type="checkbox"
              name="send_invite"
              defaultChecked
            />
            <span>
              <b>Send account setup invitation</b>
              <small>
                The employee receives a secure one-time setup link and chooses
                their own password. The administrator never sees the password.
              </small>
            </span>
          </label>
        ) : null}

        {employee ? (
          <label className="f">
            <span>Deactivation reason</span>
            <textarea
              name="deactivation_reason"
              rows={2}
              placeholder="Required only when status is Deactivated"
            />
          </label>
        ) : null}

        <div className="employee-form-actions">
          <button className="btn brand" type="submit">
            {submitLabel}
          </button>
          <Link className="btn" href="/employees">
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
