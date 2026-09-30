import { requireRole } from "@/lib/auth/current-profile";
import { TEAM_ROLES } from "@/lib/navigation";
import { PhaseNotice } from "@/components/shared/phase-notice";
export default async function ReportsPage(){await requireRole(TEAM_ROLES);return <PhaseNotice title="Reports" subtitle="Scrum, attendance, hours, leave and requests" phase={7} description="Static report rows were removed. Reports will be generated from the operational records created by the earlier phases."/>}
