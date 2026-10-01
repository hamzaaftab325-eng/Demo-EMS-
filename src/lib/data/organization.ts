import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/current-profile";
import type { EmsRole } from "@/lib/navigation";
import type { Database } from "@/types/database";

type EmploymentType = Database["public"]["Enums"]["employment_type"];
type EmploymentStatus = Database["public"]["Enums"]["employment_status"];

export type EmployeeRow = {
  id: string;
  employeeCode: string;
  email: string;
  fullName: string;
  jobTitle: string;
  departmentId: string;
  department: string;
  role: EmsRole;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  timezone: string;
  hireDate: string | null;
  isActive: boolean;
  authLinked: boolean;
  authInvitedAt: string | null;
  authActivatedAt: string | null;
  managerId: string | null;
  managerName: string | null;
  scheduleId: string | null;
  scheduleName: string | null;
};

export type DepartmentOption = {
  id: string;
  name: string;
  code: string;
};

export type ScheduleOption = {
  id: string;
  name: string;
};

export type ManagerOption = {
  id: string;
  fullName: string;
  role: EmsRole;
};

export type OrganizationOptions = {
  departments: DepartmentOption[];
  schedules: ScheduleOption[];
  managers: ManagerOption[];
};

function sameEnvironment<T extends { is_test_account: boolean }>(
  rows: T[],
  profile: CurrentProfile,
) {
  return rows.filter((row) => row.is_test_account === profile.is_test_account);
}

export async function getEmployeeDirectory(
  profile: CurrentProfile,
): Promise<EmployeeRow[]> {
  const supabase = await createClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      "id, employee_code, email, full_name, job_title, department_id, employment_type, role, employment_status, timezone, hire_date, is_active, is_test_account, auth_user_id, auth_invited_at, auth_activated_at",
    )
    .order("employee_code");

  if (profilesError) {
    throw new Error("Could not load employees.");
  }

  const scoped = sameEnvironment(profiles ?? [], profile);
  const ids = scoped.map((row) => row.id);

  if (ids.length === 0) {
    return [];
  }

  const [
    { data: departments, error: departmentsError },
    { data: reportingLines, error: reportingError },
    { data: scheduleAssignments, error: scheduleError },
    { data: schedules, error: schedulesError },
  ] = await Promise.all([
    supabase.from("departments").select("id, name, code"),
    supabase
      .from("reporting_lines")
      .select("employee_id, manager_id")
      .in("employee_id", ids)
      .eq("is_primary", true)
      .is("effective_to", null),
    supabase
      .from("schedule_assignments")
      .select("employee_id, schedule_id")
      .in("employee_id", ids)
      .is("effective_to", null),
    supabase.from("work_schedules").select("id, name"),
  ]);

  if (
    departmentsError ||
    reportingError ||
    scheduleError ||
    schedulesError
  ) {
    throw new Error("Could not load organization relationships.");
  }

  const departmentMap = new Map(
    (departments ?? []).map((row) => [row.id, row.name]),
  );
  const profileMap = new Map(scoped.map((row) => [row.id, row]));
  const managerMap = new Map(
    (reportingLines ?? []).map((row) => [row.employee_id, row.manager_id]),
  );
  const scheduleAssignmentMap = new Map(
    (scheduleAssignments ?? []).map((row) => [
      row.employee_id,
      row.schedule_id,
    ]),
  );
  const scheduleMap = new Map(
    (schedules ?? []).map((row) => [row.id, row.name]),
  );

  return scoped.map((row) => {
    const managerId = managerMap.get(row.id) ?? null;
    const scheduleId = scheduleAssignmentMap.get(row.id) ?? null;
    const manager = managerId ? profileMap.get(managerId) : null;

    return {
      id: row.id,
      employeeCode: row.employee_code,
      email: row.email,
      fullName: row.full_name,
      jobTitle: row.job_title,
      departmentId: row.department_id,
      department: departmentMap.get(row.department_id) ?? "Unknown",
      role: row.role as EmsRole,
      employmentType: row.employment_type,
      employmentStatus: row.employment_status,
      timezone: row.timezone,
      hireDate: row.hire_date,
      isActive: row.is_active,
      authLinked: Boolean(row.auth_user_id),
      authInvitedAt: row.auth_invited_at,
      authActivatedAt: row.auth_activated_at,
      managerId,
      managerName: manager?.full_name ?? null,
      scheduleId,
      scheduleName: scheduleId ? scheduleMap.get(scheduleId) ?? null : null,
    };
  });
}

export async function getOrganizationOptions(
  profile: CurrentProfile,
): Promise<OrganizationOptions> {
  const supabase = await createClient();

  const [
    { data: departments, error: departmentsError },
    { data: schedules, error: schedulesError },
    { data: managers, error: managersError },
  ] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, code")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("work_schedules")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, role, is_test_account, is_active")
      .eq("is_active", true)
      .in("role", ["manager", "director", "super_admin"])
      .order("full_name"),
  ]);

  if (departmentsError || schedulesError || managersError) {
    throw new Error("Could not load employee form options.");
  }

  return {
    departments: departments ?? [],
    schedules: schedules ?? [],
    managers: sameEnvironment(managers ?? [], profile).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      role: row.role as EmsRole,
    })),
  };
}

export async function getEmployeeById(
  profile: CurrentProfile,
  id: string,
): Promise<EmployeeRow | null> {
  const employees = await getEmployeeDirectory(profile);
  return employees.find((employee) => employee.id === id) ?? null;
}

export function getOrganizationSummary(employees: EmployeeRow[]) {
  const departments = new Map<
    string,
    { name: string; total: number; active: number }
  >();

  for (const employee of employees) {
    const current = departments.get(employee.departmentId) ?? {
      name: employee.department,
      total: 0,
      active: 0,
    };

    current.total += 1;
    if (employee.isActive) current.active += 1;
    departments.set(employee.departmentId, current);
  }

  return {
    total: employees.length,
    active: employees.filter((employee) => employee.isActive).length,
    directors: employees.filter((employee) => employee.role === "director")
      .length,
    managers: employees.filter((employee) => employee.role === "manager")
      .length,
    employees: employees.filter((employee) => employee.role === "employee")
      .length,
    onLeave: employees.filter(
      (employee) => employee.employmentStatus === "on_leave",
    ).length,
    linked: employees.filter((employee) => employee.authLinked).length,
    departments: Array.from(departments.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}
