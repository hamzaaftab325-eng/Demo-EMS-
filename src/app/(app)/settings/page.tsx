import { requireRole } from "@/lib/auth/current-profile";
import { ADMIN_ROLES } from "@/lib/navigation";
import { PhaseNotice } from "@/components/shared/phase-notice";
export default async function SettingsPage(){await requireRole(ADMIN_ROLES);return <PhaseNotice title="Settings" subtitle="Company-wide defaults" phase={8} description="The previous hardcoded settings form was removed. Phase 8 will bind this screen directly to company_settings, schedules, holidays and leave types."/>}
