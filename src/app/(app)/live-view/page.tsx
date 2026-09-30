import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function LiveViewPage() {
  return (
    <ModulePlaceholder
      title="Live View"
      phase={5}
      description="Realtime employee presence is built after the My Day workday flow is operational."
      items={[
        "Active / Idle / Away",
        "Break and meeting states",
        "Realtime manager visibility",
      ]}
    />
  );
}
