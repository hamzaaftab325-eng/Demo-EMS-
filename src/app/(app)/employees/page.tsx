import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function EmployeesPage() {
  return (
    <ModulePlaceholder
      title="Employees"
      phase={3}
      description="Employee profiles, departments, reporting hierarchy and schedules become operational in Phase 3."
      items={[
        "Employee profiles",
        "Reporting hierarchy",
        "Role and schedule assignment",
      ]}
    />
  );
}
