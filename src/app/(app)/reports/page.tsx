import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function ReportsPage() {
  return (
    <ModulePlaceholder
      title="Reports"
      phase={7}
      description="Reports reuse operational data produced by earlier phases instead of storing separate report copies."
      items={["Scrum and attendance", "Hours and leave", "CSV exports"]}
    />
  );
}
