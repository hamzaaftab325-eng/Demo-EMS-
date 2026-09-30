import { requireRole } from "@/lib/auth/current-profile";
import { TEAM_ROLES } from "@/lib/navigation";
import { PhaseNotice } from "@/components/shared/phase-notice";
export default async function ScrumBoardPage(){await requireRole(TEAM_ROLES);return <PhaseNotice title="Scrum board" subtitle="Team scrum and blockers" phase={7} description="Phase 4 scrum records are already live and protected by reporting-scope RLS. Phase 7 adds the manager monitoring UI for team progress, blockers, filters and manager-added work without duplicating scrum data."/>}
