import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Settings"
      phase={8}
      description="Company-wide schedules, holidays, leave types and workflow settings are managed here in Phase 8."
      items={[
        "Company defaults",
        "Schedules and holidays",
        "Approval and scrum rules",
      ]}
    />
  );
}
