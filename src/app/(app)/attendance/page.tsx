import { requireRole } from "@/lib/auth/current-profile";
import { TEAM_ROLES } from "@/lib/navigation";
import { PhaseNotice } from "@/components/shared/phase-notice";
export default async function AttendancePage(){await requireRole(TEAM_ROLES);return <PhaseNotice title="Attendance" subtitle="Workdays, hours and corrections" phase={5} description="Static attendance rows were removed. Attendance becomes live after My Day creates real workday events."/>}
