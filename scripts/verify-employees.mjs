import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required Phase 3 file: ${path}`);
  }
  return fs.readFileSync(path, "utf8");
}

function requireText(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label}: expected ${JSON.stringify(needle)}`);
  }
}

function rejectText(content, needle, label) {
  if (content.includes(needle)) {
    throw new Error(`${label}: forbidden ${JSON.stringify(needle)}`);
  }
}

const edge = read("supabase/functions/employee-account/index.ts");
requireText(edge, 'action: "assign_work_email"', "Employee account function");
requireText(edge, "inviteUserByEmail", "Employee account function");
requireText(edge, "updateUserById", "Employee account function");
requireText(edge, "deleteUser", "Employee account resend flow");
requireText(edge, "work_email_assigned", "Employee account function");
rejectText(
  edge,
  "resetPasswordForEmail",
  "Employee onboarding must not use password recovery",
);

const form = read("src/components/employees/employee-form.tsx");
requireText(form, 'name="personal_email"', "Employee form");
requireText(form, 'name="work_email"', "Employee form");
requireText(form, "Current login email", "Employee form");
requireText(form, "System access", "Employee form identity help");

const actions = read("src/app/(app)/employees/actions.ts");
requireText(actions, "assignEmployeeWorkEmail", "Employee actions");
requireText(actions, 'action: "assign_work_email"', "Employee actions");
requireText(actions, "p_personal_email", "Employee actions");
requireText(actions, "p_work_email", "Employee actions");

const employeePage = read("src/app/(app)/employees/[id]/page.tsx");
requireText(employeePage, "Assign work login email", "Employee System access");
requireText(employeePage, "same password", "Employee System access");
requireText(employeePage, "Resend account setup", "Employee System access");

const organization = read("src/lib/data/organization.ts");
requireText(
  organization,
  'from("employee_access_contacts")',
  "Employee access contact loading",
);
requireText(organization, "personalEmail", "Employee access contact loading");
requireText(organization, "workEmail", "Employee access contact loading");

const types = read("src/types/database.ts");
requireText(types, "employee_access_contacts:", "Generated Supabase types");
requireText(
  types,
  "service_assign_employee_work_email",
  "Generated Supabase types",
);

const forgot = read("src/components/auth/forgot-password-form.tsx");
requireText(
  forgot,
  "Current EMS login email",
  "Forgot-password identity wording",
);
requireText(
  forgot,
  'employee-password-recovery',
  "Forgot-password guarded recovery endpoint",
);
rejectText(
  forgot,
  "resetPasswordForEmail",
  "Forgot-password form must not bypass EMS activation state",
);

const recovery = read(
  "supabase/functions/employee-password-recovery/index.ts",
);
requireText(
  recovery,
  "auth_activated_at",
  "Password recovery activation guard",
);
requireText(
  recovery,
  "resetPasswordForEmail",
  "Password recovery delivery",
);
requireText(
  recovery,
  "If an active EMS account exists",
  "Password recovery anti-enumeration response",
);

const login = read("src/app/login/page.tsx");
requireText(login, "Work / login email", "Login identity wording");
requireText(login, "same password", "Login work-email transition wording");

const migration = read(
  "supabase/migrations/20261001142729_phase3_employee_access_lifecycle.sql",
);
requireText(
  migration,
  "employee_access_contacts",
  "Employee access lifecycle migration",
);
requireText(
  migration,
  "Login email changes must use System access.",
  "Employee login identity guard",
);

const collision = read(
  "supabase/migrations/20261001144023_phase3_employee_access_email_collision_guard.sql",
);
requireText(
  collision,
  "validate_employee_access_contact_identity",
  "Employee access collision guard",
);

console.log("Phase 3 employee access verification passed.");
