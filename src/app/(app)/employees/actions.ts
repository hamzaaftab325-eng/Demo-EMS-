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
      p_hire_date: hireDate,
      p_manager_id: managerId,
      p_schedule_id: scheduleId,
      p_is_test_account: current.is_test_account,
    },
  );

  if (error || !employeeId) {
    fail(
      "/employees/new",
      "Could not create employee. Check the employee code, email and hierarchy.",
    );
  }

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  redirect(`/employees/${employeeId}?created=1`);
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

  const { error } = await supabase.rpc("admin_update_employee", {
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
  });

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
