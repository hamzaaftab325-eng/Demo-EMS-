import { requireRole } from "@/lib/auth/current-profile";
import { TEAM_ROLES } from "@/lib/navigation";
import { PhaseNotice } from "@/components/shared/phase-notice";
export default async function ScrumBoardPage(){await requireRole(TEAM_ROLES);return <PhaseNotice title="Scrum board" subtitle="Team scrum and blockers" phase={7} description="Static scrum cards were removed. The board will reuse the real scrum records created by employees rather than maintaining a second copy."/>}
