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
type FunctionArgs<T> = T extends { Args: infer A } ? A : never;
type AdminCreateEmployeeArgs = FunctionArgs<
  Database["public"]["Functions"]["admin_create_employee"]
>;
type AdminUpdateEmployeeArgs = FunctionArgs<
  Database["public"]["Functions"]["admin_update_employee"]
>;

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
    return "This login email is already assigned to another employee.";
  }

  if (clean.includes("Personal/setup email is already assigned")) {
    return "This setup email is already assigned to another employee.";
  }

  if (clean.includes("Production employees require a work email")) {
    return "Production employees require an @emarketselect.com work email.";
  }

  if (clean.includes("Production work email must use")) {
    return "Production work email must use @emarketselect.com.";
  }

  if (clean.includes("current EMS environment")) {
    return "The employee must be created in the same EMS environment as the administrator.";
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

type AccessStatus =
  | "work_email_assigned"
  | "work_email_already_assigned"
  | "requires_activation"
  | "invalid_work_email"
  | "work_email_failed"
  | "failed";

async function invokeEmployeeAccount(
  body: Record<string, string>,
): Promise<{ status: string; message?: string }> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { status: "failed", message: "Your administrator session expired." };
  }

  const { data, error } = await supabase.functions.invoke("employee-account", {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    return { status: "failed", message: "The employee access service rejected the request." };
  }

  const status =
    data && typeof data === "object" && "status" in data
      ? String(data.status)
      : "failed";
  const message =
    data && typeof data === "object" && "message" in data
      ? String(data.message)
      : undefined;

  return { status, message };
}

async function sendAccountSetup(employeeId: string): Promise<InviteStatus> {
  const result = await invokeEmployeeAccount({
    action: "invite",
    employee_id: employeeId,
  });

  if (
    result.status === "sent" ||
    result.status === "resent" ||
    result.status === "already_active" ||
    result.status === "demo_address" ||
    result.status === "demo_email_not_authorized" ||
    result.status === "email_rate_limited"
  ) {
    return result.status;
  }

  return "failed";
}

export async function createEmployee(formData: FormData) {
  const current = await requireRole(ADMIN_ROLES);
  const supabase = await createClient();

  const employeeCode = textValue(formData, "employee_code");
  const personalEmail = textValue(formData, "personal_email").toLowerCase();
  const workEmail = nullableValue(formData, "work_email")?.toLowerCase() ?? null;
  const loginEmail = current.is_test_account
    ? personalEmail
    : workEmail ?? personalEmail;
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
    !personalEmail ||
    !loginEmail ||
    !fullName ||
    !jobTitle ||
    !departmentId ||
    !employmentType ||
    !role
  ) {
    fail("/employees/new", "Complete all required employee fields.");
  }

  if (!current.is_test_account && !workEmail) {
    fail(
      "/employees/new",
      "Production employees require an @emarketselect.com work email.",
    );
  }

  const createArgs = {
    p_employee_code: employeeCode,
    p_email: loginEmail,
    p_full_name: fullName,
    p_job_title: jobTitle,
    p_department_id: departmentId,
    p_employment_type: employmentType,
    p_role: role,
    p_timezone: timezone,
    p_hire_date: hireDate,
    p_manager_id: managerId,
    p_schedule_id: scheduleId,
    p_is_test_account: current.is_test_account,
    p_personal_email: personalEmail,
    p_work_email: workEmail,
  } as unknown as AdminCreateEmployeeArgs;

  const { data: employeeId, error } = await supabase.rpc(
    "admin_create_employee",
    createArgs,
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
  const personalEmail = textValue(formData, "personal_email").toLowerCase();
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

  if (!personalEmail) {
    fail(`/employees/${employeeId}`, "Setup email is required.");
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
    p_personal_email: personalEmail,
  } as unknown as AdminUpdateEmployeeArgs;

  const { error } = await supabase.rpc("admin_update_employee", updateArgs);

  if (error) {
    const clean = error.message.replace(/^.*?:\s*/, "").trim();
    fail(
      `/employees/${employeeId}`,
      clean.includes("Login email changes must use System access")
        ? "Change the employee login identity from System access, not the profile form."
        : clean.includes("Personal/recovery email is already assigned")
          ? "This setup email is already assigned to another employee."
          : "Could not update employee. Check unique fields, reporting hierarchy and deactivation reason.",
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

export async function assignEmployeeWorkEmail(formData: FormData) {
  await requireRole(ADMIN_ROLES);

  const employeeId = textValue(formData, "employee_id");
  const workEmail = textValue(formData, "work_email").toLowerCase();

  if (!employeeId) {
    fail("/employees", "Employee ID is missing.");
  }

  if (!workEmail) {
    fail(`/employees/${employeeId}`, "Enter the employee work email.");
  }

  const result = await invokeEmployeeAccount({
    action: "assign_work_email",
    employee_id: employeeId,
    work_email: workEmail,
  });
  const status = result.status as AccessStatus;

  if (
    status !== "work_email_assigned" &&
    status !== "work_email_already_assigned"
  ) {
    fail(
      `/employees/${employeeId}`,
      result.message ??
        (status === "requires_activation"
          ? "The employee must finish account setup before a work email can be assigned."
          : status === "invalid_work_email"
            ? "Enter a valid work email."
            : "Could not assign the employee work email."),
    );
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/dashboard");

  redirect(`/employees/${employeeId}?access=${status}`);
}


export async function deactivateEmployee(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const employeeId = textValue(formData, "employee_id");
  const reason = textValue(formData, "reason");

  if (!employeeId) fail("/employees", "Employee ID is missing.");
  if (!reason) fail(`/employees/${employeeId}`, "Enter a deactivation reason.");

  const { error } = await supabase.rpc("admin_deactivate_employee", {
    p_employee_id: employeeId,
    p_reason: reason,
  });

  if (error) {
    fail(
      `/employees/${employeeId}`,
      error.message.replace(/^.*?:\s*/, "").trim() ||
        "Could not deactivate employee.",
    );
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/dashboard");
  redirect(`/employees/${employeeId}?deactivated=1`);
}

export async function deleteDemoEmployee(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const employeeId = textValue(formData, "employee_id");
  const employeeCode = textValue(formData, "employee_code");
  const confirmation = textValue(formData, "confirmation");
  const reason = textValue(formData, "reason");

  if (!employeeId) fail("/employees", "Employee ID is missing.");
  if (!employeeCode || confirmation !== employeeCode) {
    fail(
      `/employees/${employeeId}`,
      "Enter the employee code exactly to confirm deletion.",
    );
  }
  if (!reason) fail(`/employees/${employeeId}`, "Enter a deletion reason.");

  const result = await invokeEmployeeAccount({
    action: "delete_demo_employee",
    employee_id: employeeId,
    reason,
  });

  if (result.status !== "deleted") {
    fail(
      `/employees/${employeeId}`,
      result.message ?? "Could not delete the demo employee.",
    );
  }

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  redirect("/employees?deleted=1");
}
