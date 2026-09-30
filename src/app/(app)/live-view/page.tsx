import { requireRole } from "@/lib/auth/current-profile";
import { TEAM_ROLES } from "@/lib/navigation";
import { PhaseNotice } from "@/components/shared/phase-notice";
export default async function LiveViewPage(){await requireRole(TEAM_ROLES);return <PhaseNotice title="Live view" subtitle="Realtime employee presence" phase={5} description="Static presence statuses were removed. Live status will come from employee_presence and workday events in Phase 5."/>}
