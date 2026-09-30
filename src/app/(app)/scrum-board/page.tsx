import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function ScrumBoardPage() {
  return (
    <ModulePlaceholder
      title="Scrum Board"
      phase={7}
      description="Managers will review the same scrum records created by employees—no second scrum data model."
      items={[
        "Team scrum filters",
        "Progress and blockers",
        "Manager-added tasks",
      ]}
    />
  );
}
