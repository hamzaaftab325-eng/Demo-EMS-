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
        subtitle="Create the employee, reporting line, schedule and secure login invitation in one flow."
      />

      {error ? <div className="form-error">{error}</div> : null}

      <EmployeeForm
        action={createEmployee}
        departments={options.departments}
        schedules={options.schedules}
        managers={options.managers}
        submitLabel="Create employee"
      />

      <p className="preview-note">
        The EMS profile is created first. If invitation is enabled, Supabase
        emails the employee a one-time account setup link. The employee chooses
        their own password; public sign-up remains disabled.
      </p>
    </>
  );
}
