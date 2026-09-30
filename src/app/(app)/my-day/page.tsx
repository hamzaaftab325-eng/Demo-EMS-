import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function MyDayPage() {
  return (
    <ModulePlaceholder
      title="My Day"
      phase={4}
      description="Employee sign-in, scrum, progress, breaks, meetings and sign-off are implemented in Phase 4."
      items={[
        "Sign-in scrum",
        "Task progress and backlog",
        "Break / meeting / sign-off controls",
      ]}
    />
  );
}
