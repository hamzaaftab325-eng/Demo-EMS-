"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-profile";
import { ADMIN_ROLES } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AppRole = Database["public"]["Enums"]["app_role"];
type EmploymentType = Database["public"]["Enums"]["employment_type"];
type EmploymentStatus = Database["public"]["Enums"]["employment_status"];

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

function fail(path: string, message: string): never {
  const params = new URLSearchParams({ error: message });
  redirect(`${path}?${params.toString()}`);
}

function createEmployeeErrorMessage(message: string) {
  const clean = message.replace(/^.*?:\s*/, "").trim();

  if (clean.includes("Employee code already exists")) {
    return "Employee code already exists. Use a unique employee code.";
  }

  if (clean.includes("Email is already assigned")) {
    return "Email is already assigned to another employee.";
  }

  if (clean.includes("Select an active department")) {
    return "Select an active department.";
  }

  if (clean.includes("Select an active manager")) {
    return "Select an active manager in the same EMS environment.";
  }

  if (clean.includes("Select an active work schedule")) {
    return "Select an active work schedule.";
  }

  if (clean.includes("profiles_allowed_email")) {
    return "Use a valid email address for this employee.";
  }

  if (clean.includes("Super Admin")) {
    return "Only an active Super Admin can create employees.";
  }

  return clean || "Could not create employee. Review the form and try again.";
}

type InviteStatus =
  | "sent"
  | "resent"
  | "already_active"
  | "demo_address"
  | "demo_email_not_authorized"
  | "email_rate_limited"
  | "failed";

async function sendAccountSetup(employeeId: string): Promise<InviteStatus> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return "failed";
  }

  const { data, error } = await supabase.functions.invoke(
    "employee-account",
    {
      body: {
        action: "invite",
        employee_id: employeeId,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  if (error) {
    return "failed";
  }

  const status =
    data && typeof data === "object" && "status" in data
      ? String(data.status)
      : "";

  if (
    status === "sent" ||
    status === "resent" ||
    status === "already_active" ||
    status === "demo_address" ||
    status === "demo_email_not_authorized" ||
    status === "email_rate_limited"
  ) {
    return status;
  }

  return "failed";
}

export async function createEmployee(formData: FormData) {
  const current = await requireRole(ADMIN_ROLES);
  const supabase = await createClient();

  const employeeCode = textValue(formData, "employee_code");
  const email = textValue(formData, "email").toLowerCase();
  const fullName = textValue(formData, "full_name");
  const jobTitle = textValue(formData, "job_title");
  const departmentId = textValue(formData, "department_id");
  const employmentType = textValue(formData, "employment_type") as EmploymentType;
  const role = textValue(formData, "role") as AppRole;
  const timezone = textValue(formData, "timezone") || "Asia/Karachi";
  const hireDate = nullableValue(formData, "hire_date");
  const managerId = nullableValue(formData, "manager_id");
  const scheduleId = nullableValue(formData, "schedule_id");

  if (
    !employeeCode ||
    !email ||
    !fullName ||
    !jobTitle ||
    !departmentId ||
    !employmentType ||
    !role
  ) {
    fail("/employees/new", "Complete all required employee fields.");
  }

  const { data: employeeId, error } = await supabase.rpc(
    "admin_create_employee",
    {
      p_employee_code: employeeCode,
      p_email: email,
      p_full_name: fullName,
      p_job_title: jobTitle,
      p_department_id: departmentId,
      p_employment_type: employmentType,
      p_role: role,
      p_timezone: timezone,
      p_hire_date: hireDate ?? undefined,
      p_manager_id: managerId ?? undefined,
      p_schedule_id: scheduleId ?? undefined,
      p_is_test_account: current.is_test_account,
    },
  );

  if (error || !employeeId) {
    fail(
      "/employees/new",
      createEmployeeErrorMessage(
        error?.message ?? "Employee creation did not return an employee ID.",
      ),
    );
  }

  const shouldInvite = formData.get("send_invite") === "on";
  const inviteStatus = shouldInvite
    ? await sendAccountSetup(employeeId)
    : null;

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/dashboard");

  const params = new URLSearchParams({ created: "1" });
  if (inviteStatus) params.set("invite", inviteStatus);

  redirect(`/employees/${employeeId}?${params.toString()}`);
}

export async function updateEmployee(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();

  const employeeId = textValue(formData, "employee_id");
  const employeeCode = textValue(formData, "employee_code");
  const email = textValue(formData, "email").toLowerCase();
  const fullName = textValue(formData, "full_name");
  const jobTitle = textValue(formData, "job_title");
  const departmentId = textValue(formData, "department_id");
  const employmentType = textValue(formData, "employment_type") as EmploymentType;
  const role = textValue(formData, "role") as AppRole;
  const timezone = textValue(formData, "timezone") || "Asia/Karachi";
  const hireDate = nullableValue(formData, "hire_date");
  const managerId = nullableValue(formData, "manager_id");
  const scheduleId = nullableValue(formData, "schedule_id");
  const employmentStatus = textValue(
    formData,
    "employment_status",
  ) as EmploymentStatus;
  const deactivationReason = nullableValue(formData, "deactivation_reason");

  if (!employeeId) {
    fail("/employees", "Employee ID is missing.");
  }

  const updateArgs = {
    p_employee_id: employeeId,
    p_employee_code: employeeCode,
    p_email: email,
    p_full_name: fullName,
    p_job_title: jobTitle,
    p_department_id: departmentId,
    p_employment_type: employmentType,
    p_role: role,
    p_timezone: timezone,
    p_hire_date: hireDate,
    p_manager_id: managerId,
    p_schedule_id: scheduleId,
    p_employment_status: employmentStatus,
    p_deactivation_reason: deactivationReason,
  } as unknown as Database["public"]["Functions"]["admin_update_employee"]["Args"];

  const { error } = await supabase.rpc("admin_update_employee", updateArgs);

  if (error) {
    fail(
      `/employees/${employeeId}`,
      "Could not update employee. Check unique fields, reporting hierarchy and deactivation reason.",
    );
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/dashboard");
  redirect(`/employees/${employeeId}?updated=1`);
}


export async function sendEmployeeInvite(formData: FormData) {
  await requireRole(ADMIN_ROLES);

  const employeeId = textValue(formData, "employee_id");
  if (!employeeId) {
    fail("/employees", "Employee ID is missing.");
  }

  const inviteStatus = await sendAccountSetup(employeeId);

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);

  redirect(`/employees/${employeeId}?invite=${inviteStatus}`);
}
