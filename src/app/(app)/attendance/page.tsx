import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function AttendancePage() {
  return (
    <ModulePlaceholder
      title="Attendance"
      phase={5}
      description="Attendance is calculated from the same workday events created by My Day rather than duplicated manual records."
      items={[
        "Hours and target",
        "Break totals and status",
        "Corrections with audit trail",
      ]}
    />
  );
}
