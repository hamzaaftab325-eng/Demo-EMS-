import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function DashboardPage() {
  return (
    <ModulePlaceholder
      title="Dashboard"
      phase={7}
      description="The shared EMS shell is ready. Management metrics and live team data are connected in Phase 7."
      items={[
        "Team status overview",
        "Pending approvals",
        "Blockers and attention items",
      ]}
    />
  );
}
