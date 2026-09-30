import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function RequestsPage() {
  return (
    <ModulePlaceholder
      title="Requests"
      phase={6}
      description="Leave, shift change and hour change requests are connected to the approval workflow in Phase 6."
      items={[
        "Leave requests",
        "Shift and hour changes",
        "Approval history and notifications",
      ]}
    />
  );
}
