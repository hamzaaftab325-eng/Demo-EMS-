import { PhaseNotice } from "@/components/shared/phase-notice";
import { requireCurrentProfile } from "@/lib/auth/current-profile";

export default async function MyDayPage() {
  const profile = await requireCurrentProfile();

  return (
    <PhaseNotice
      title={`Hi ${profile.full_name}`}
      subtitle="My Day & Scrum"
      phase={4}
      description="The old sample tasks and fake timeline were removed. Phase 4 will connect this approved UI flow to the real scrum, workday, break and meeting tables."
    />
  );
}
