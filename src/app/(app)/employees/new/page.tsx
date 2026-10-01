import { PageHead } from "@/components/shared/prototype";
import { EmployeeForm } from "@/components/employees/employee-form";
import { createEmployee } from "@/app/(app)/employees/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { ADMIN_ROLES } from "@/lib/navigation";
import { getOrganizationOptions } from "@/lib/data/organization";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireRole(ADMIN_ROLES);
  const options = await getOrganizationOptions(current);
  const params = await searchParams;
  const error = single(params.error);

  return (
    <>
      <PageHead
        title="Add employee"
        subtitle="Create the employee, organization assignment and secure account setup in one trusted flow."
      />

      {error ? <div className="form-error">{error}</div> : null}

      <EmployeeForm
        action={createEmployee}
        departments={options.departments}
        schedules={options.schedules}
        managers={options.managers}
        submitLabel="Create employee"
        isTestEnvironment={current.is_test_account}
      />

      <p className="preview-note">
        {current.is_test_account
          ? "Demo flow: use a real setup mailbox for the first invitation. The employee chooses their password, then a Super Admin can assign the final work login email from System access without changing that password."
          : "Production flow: the employee work email is the login identity and receives the secure account setup invitation. The employee chooses their own password; public sign-up remains disabled."}
      </p>
    </>
  );
}
