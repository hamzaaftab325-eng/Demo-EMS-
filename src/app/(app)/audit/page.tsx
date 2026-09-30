import { requireRole } from "@/lib/auth/current-profile";
import { ADMIN_ROLES } from "@/lib/navigation";
import { PhaseNotice } from "@/components/shared/phase-notice";
export default async function AuditPage(){await requireRole(ADMIN_ROLES);return <PhaseNotice title="Audit log" subtitle="Sensitive changes and administrative actions" phase={8} description="The database is already recording Phase 3 employee changes. The full audit review interface is completed in Phase 8."/>}
