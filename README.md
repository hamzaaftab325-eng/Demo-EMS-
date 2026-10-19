# eMarketSelect EMS

Production Employee Management System for eMarketSelect.

## Current status

**Phases 1–8: COMPLETE AND STABILIZED**

The repository contains the complete Phase 1–8 EMS feature foundation: project
infrastructure, authentication and access, employees and organization, My Day
and Scrum, attendance and live presence, requests and approvals, management
reporting, and Super Admin audit/settings workflows.

The current focus after Phase 8 is engineering hardening and production
readiness, not adding another feature phase indiscriminately.

## Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4 + approved EMS prototype design system
- Supabase PostgreSQL, Auth, RLS and Realtime
- Vercel deployment from `main`

### Runtime baseline

- Node.js 24.x is the single supported runtime for local development, GitHub CI, and Vercel.
- `package.json`, `package-lock.json`, and CI are aligned to Node 24.x so Vercel does not apply a version override.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Run `npm ci`.
3. Run `npm run dev`.

Only the Supabase URL and publishable key belong in browser-visible environment
variables. Never expose a Supabase secret/service-role key in `NEXT_PUBLIC_*`.

## Authentication and authorization

- Public sign-up is intentionally disabled.
- Super Admin creates the employee profile first and controls account setup from System access.
- Setup/personal contact and current login identity are stored as separate concepts.
- The invite creates/links the Supabase Auth identity to the employee's current login email.
- The employee opens the one-time account-setup link, chooses their own password, and EMS records activation.
- If setup is incomplete, Super Admin can resend a fresh account-setup invitation; EMS does not misuse password recovery for onboarding.
- In the demo flow, Super Admin can assign a work login email after activation; the Auth identity and EMS profile change together and the employee keeps the same password.
- Linked login identities cannot be edited through the ordinary employee profile form.
- Forgot Password is available only for an already-activated active EMS account and sends recovery to the current login email.
- Users must be linked to an active `public.profiles` row before application access is granted.
- Application roles come from `public.profiles.role`, never user-editable Auth metadata.
- RLS is the final database authorization layer.
- Super Admin can manage the full organization.
- Director can see their reporting subtree.
- Manager can see their reporting subtree.
- Employee can see their own scoped data.

The approved roadmap is stored in `docs/EMS_Production_Plan_FINAL.docx`.

## Phase 1 — Project Foundation

Phase 1 established the production Next.js/Supabase foundation, versioned schema
baseline, server/browser Supabase separation, security headers, global error
handling and CI quality gate.

## Phase 2 — Auth & Access

Phase 2 added real Supabase authentication, activation-aware access, protected
role/profile guards and RLS-backed authorization.

## Phase 3 — Employees & Company Structure

Phase 3 includes:

- Real employee directory backed by `public.profiles`
- Employee detail and Super Admin create/edit/deactivate workflows
- Departments and current work schedules from Supabase
- Historical reporting lines and schedule assignments
- Real `Director` role
- Hierarchy: Super Admin / CEO → Director → Manager → Employees
- Database-level reporting-cycle protection
- Employee status history
- Audit records for employee create/update actions
- Demo vs production profile separation
- Static employee/dashboard organization data removed
- Generated TypeScript types synchronized with the live schema
- Separate setup/personal email and work/login identity lifecycle
- Super Admin-only work-email assignment after activation for demo onboarding
- Linked Auth login identities cannot drift through ordinary profile edits
- Account-setup resend is a fresh invite, never a password-recovery email
- Password recovery is limited to already-activated active EMS accounts
- Demo onboarding always sends the first setup invitation to the setup email
- Planned work email remains pending until password setup is complete
- Dedicated Super Admin deactivate control with preserved history
- Archived demo employee deletion that releases email/code for reuse
- Deleted employee archive visible to Super Admin

## Demo data

The demo environment is intentionally mutable during onboarding and regression
QA. Do not treat README sample employee rows as authoritative. The live
`public.profiles` data and the EMS Employees screen are the source of truth.

## Phase 4 — My Day & Scrum

My Day & Scrum is backed by transactional Supabase workflows:

- Sign in with a required Scrum cycle
- Previous signed-off Scrum visibility
- Carry-over and backlog selection
- New cycle and backlog items
- Progress history
- Sign-in, during-day, and sign-off obstacles
- Break and meeting intervals
- Sign off with final percentages and notes
- Incomplete items remain active for the next cycle
- 100% items close as completed
- Sign back in on the same work date
- Real timeline from attendance events and work intervals

### Cross-midnight workdays

An open workday remains the employee's active My Day after local midnight until
it is signed off or automatically signed off for inactivity. Heartbeat, breaks,
meetings, obstacles, task additions and sign-off all resolve the same open
workday instead of creating a second day's session. A partial unique index
prevents more than one open workday per employee.

The My Day timeline uses the employee's target work duration as its visible
window, including overnight sessions.

## Phase 5 — Attendance & Live Presence

Phase 5 is complete and live with:

- Heartbeat and last-activity timestamps
- Active / Idle / Away / Break / Meeting / Signed-off presence states
- Attendance calculations and target hours
- Fixed, flexible and flexible-core lateness rules
- Break and meeting calculations
- CSV export
- Super Admin attendance corrections with mandatory reason and audit history
- Automatic inactivity sign-off
- Manager Live View and reporting-subtree visibility
- Realtime presence/workday refresh
- Cross-midnight workday continuity

### Phase 5 production behavior

- Heartbeat sends only a timestamp about once per minute while the EMS app is open.
- Last activity stores only the timestamp of EMS interaction, never interaction content.
- Active: activity within 5 minutes while heartbeat is current.
- Idle: no EMS interaction for 5–15 minutes while heartbeat continues.
- Away: activity is older than 15 minutes or the heartbeat is stale.
- Meetings count toward net worked time. Breaks do not.
- Flexible schedules are evaluated against target minutes and are never late.
- Fixed and flexible-core schedules use their configured start/core-start plus grace.
- Automatic sign-off preserves unfinished Scrum progress.
- Presence and attendance are RLS-scoped to self, reporting-chain managers/directors, and Super Admin.

## Phase 6 — Requests & Approvals

Phase 6 is complete with:

- Leave, shift-change and hour-change request forms
- Manager approval followed by optional final Super Admin approval
- No self-approval
- Pending request cancellation before final approval
- Working-day leave calculation excluding weekends and configured holidays
- Idempotent leave-ledger deduction on final approval
- Temporary and permanent schedule-history updates for approved schedule changes
- Request notifications and audit evidence for sensitive transitions
- Dashboard count for approvals waiting on the current manager/admin
- Approved leave reflected in Attendance and Live View when the employee has not signed in
- Direct request-table mutation removed from normal authenticated clients; state transitions use controlled RPC workflows
- Super Admin reassignment of stuck manager/final approvals
- Cross-year leave ledger handling
- Least-privilege RPC/table boundaries

### Phase 6 completion hardening

- Approved leave creates or updates attendance workdays as `on_leave` with zero scheduled minutes.
- Employees cannot sign in on an approved leave working date.
- Leave cannot be approved after work has already started for an affected date.
- Configured annual/default leave entitlements and ledger allocations are enforced; a NULL entitlement remains an explicit no-quota policy.
- Cross-year leave writes idempotent ledger segments by year.
- Hour-change requests are database-enforced as single-date requests.
- Approved schedule changes update unstarted workdays and cannot rewrite dates where work already started.
- Demo/test and production employee data are isolated at the RLS helper layer.
- Request-generated schedules remain selectable when editing the employee who currently uses them.
- A notification center exposes request workflow notifications and read/unread state.
- Exposed request RPCs are SECURITY INVOKER wrappers over private privileged implementations.

## Phase 7 — Management Dashboard, Scrum Board & Reports

Phase 7 is complete. The management layer reads the existing hierarchy-scoped
attendance, Scrum and request data rather than creating a duplicate operational
model.

Implemented areas include:

- management dashboard
- team Scrum Board
- blockers and progress visibility
- manager-added Scrum work
- employee drill-down
- scoped management reports
- CSV exports
- Realtime refresh
- reporting-subtree authorization

Manager-added Scrum work and blocker resolution run through narrow SECURITY
INVOKER RPCs that preserve the Phase 4 workflow guards.

## Phase 8 — Audit Log & Administrative Settings

Phase 8 is complete and stabilized.

Implemented areas include:

- immutable, searchable Audit Log
- company-wide EMS settings
- work-schedule administration
- holiday administration
- leave-type administration
- environment isolation for audit history
- automatic audit evidence for administrative configuration changes
- Super Admin-only server and database authorization
- protected request-generated schedule history
- protected historical holidays
- protected default schedule deactivation
- protected final active leave type
- responsive settings/audit states and guarded destructive actions

The Phase 8 UI is bound directly to the canonical tables and RPC workflows used
by Attendance, Presence, Scrum and Requests. It does not introduce a second
settings model.

See `docs/PHASE_8_ADMIN_QA.md` for the complete acceptance record.

## Employee account onboarding

Employee onboarding is part of the trusted Super Admin workflow:

1. Super Admin creates the employee with role, department, manager and schedule.
2. EMS stores a setup/personal contact separately from the planned work login identity.
3. In the demo environment, the setup email is the initial Auth/login identity and receives the one-time account setup invitation through the protected `employee-account` Edge Function. Any different work email is stored as pending.
4. The employee opens the latest invite and creates their own password.
5. Database authorization remains blocked until password setup records `auth_activated_at`.
6. If setup is incomplete, Resend account setup replaces the incomplete Auth identity and sends a fresh Invite-user email. It does not send a Reset-password email.
7. For the demo workflow, Super Admin can use System access → Assign work login email. Supabase Auth and `profiles.email` change together while the employee's password remains unchanged.
8. After work-email assignment, the employee signs in with the new work/login email plus the same password.
9. Ordinary employee editing cannot change a linked login email; identity changes are restricted to System access.
10. Forgot password uses the current work/login email and is accepted only for an activated, active EMS account. Unactivated users must use account setup instead.

The restricted `employee_access_contacts` table stores setup-contact/work-email
metadata. Only Super Admin can read it through authenticated RLS; normal
employees and reporting managers do not receive those private contact rows.

Mailbox provisioning itself is outside EMS. Production work mailboxes must
exist in the company's email platform before they can reliably receive Auth or
recovery mail.

### Demo employee deletion

Super Admin can deactivate any non-self employee. Deactivation blocks access
but keeps the employee record and history.

For demo/test employees only, Super Admin can also remove the employee from the
working directory. EMS archives the original identity and organization
snapshot, preserves historical EMS records through the retained inactive
profile, releases the original employee code/setup/work emails for reuse, moves
any linked Auth identity to an inert tombstone email, and unlinks it from EMS.
Deleted employees are shown in the Super Admin archive on the Employees page.

### Professional Auth email templates

Branded invite and password-recovery templates are stored in
`supabase/templates/`. Hosted Supabase projects require those templates to be
applied in Authentication → Email Templates; see `docs/SUPABASE_AUTH_EMAILS.md`.

The current demo uses custom SMTP. The repository never stores the SMTP
credential. Before production, replace the development sender with a verified
company sending domain.

### Phase 1–8 finalization

Phases 1 through 8 are treated as the complete functional EMS foundation before
production-hardening work begins:

- Phase 1 — Project Foundation: complete
- Phase 2 — Auth & Access: complete
- Phase 3 — Employees & Company Structure: complete
- Phase 4 — My Day & Scrum: complete
- Phase 5 — Attendance & Live Presence: complete
- Phase 6 — Requests & Approvals: complete
- Phase 7 — Management Dashboard, Scrum Board & Reports: complete
- Phase 8 — Audit Log & Administrative Settings: complete

The repository gate requires the phase verification scripts, lint, TypeScript
and production build to pass in GitHub Actions. Deployment acceptance additionally
requires applied Supabase migrations, correct RLS/grants, zero QA residue and a
successful Vercel deployment.

## Phase 1 foundation gate

The Phase 1 application foundation is protected by `npm run foundation:check`
plus lint, TypeScript and production build in GitHub Actions. The original
29-table foundation snapshot is captured under `supabase/baseline/`; later
phases extend that schema through versioned migrations. Global error handling
and internal-app security headers are enabled, and browser/server Supabase
clients remain separated.

See `docs/PHASE_1_FOUNDATION_QA.md` for the acceptance record.

## Phase 2 authentication gate

Authentication and access are guarded by `npm run auth:check`, the Supabase
session/profile guard, role-aware route checks and PostgreSQL RLS. Account
activation is part of the database authorization identity: an invite session
cannot access operational EMS data until password setup completes.

See `docs/PHASE_2_AUTH_QA.md` for the acceptance matrix.

## Phase 3 employee access gate

The employee identity/onboarding workflow is protected by
`npm run employees:check` plus lint, TypeScript and production build in GitHub
Actions. The gate verifies setup/work-email separation, trusted work-login
assignment, fresh-invite resend behavior, guarded password recovery,
synchronized Supabase types and the versioned access-lifecycle migrations.

See `docs/PHASE_3_EMPLOYEE_ACCESS_QA.md` for the acceptance matrix.

## Phase 4 My Day gate

Phase 4 — My Day & Scrum is protected by `npm run myday:check` plus lint,
TypeScript and the production build in GitHub Actions. The gate verifies the
employee sign-in Scrum, previous/carry-over/backlog data, progress history,
obstacles, break/meeting actions, complete/incomplete sign-off behavior,
sign-back-in history, cross-midnight active-workday safety and workflow-only
writes.

Live rollback acceptance tests also verify 100% completion, <100% carry-over,
duplicate sign-off safety and normal-employee RLS isolation.

See `docs/PHASE_4_MY_DAY_QA.md` for the acceptance matrix.

## Phase 5 attendance gate

Phase 5 — Attendance & Live Presence is protected by `npm run attendance:check`
plus lint, TypeScript and the production build in GitHub Actions. The gate
covers heartbeat/presence transitions, attendance calculations, schedule
lateness rules, auto sign-off, cross-midnight Live View continuity, Super Admin
corrections, scoped exports and the Phase 5 hardening migrations.

Live rollback acceptance tests cover Active/Idle/Away, break and meeting math,
fixed/flexible/flexible-core schedules, automatic sign-off, manager subtree
isolation, attendance correction authorization, stale presence rollover and open
overnight workdays.

See `docs/PHASE_5_ATTENDANCE_QA.md` for the acceptance matrix.

## Phase 6 requests gate

Phase 6 — Requests & Approvals is protected by `npm run requests:check` plus
lint, TypeScript and the production build in GitHub Actions. The gate covers
leave, shift/hour changes, approval stages, cancellation/rejection, balance
enforcement, approved-leave attendance synchronization, schedule application,
notifications, Super Admin reassignment, least-privilege RPC/table boundaries
and the cross-year leave-ledger fix.

Live rollback acceptance also verifies manager subtree isolation, protected
direct writes, notification ownership, duplicate-decision safety,
temporary/permanent schedule application, approved-leave sign-in blocking and
Dec → Jan leave approval.

See `docs/PHASE_6_REQUESTS_QA.md` for the acceptance matrix.

## Phase 7 management gate

Phase 7 — Management Dashboard, Scrum Board & Reports is protected by
`npm run phase7:check` plus lint, TypeScript and the production build.

The phase uses the existing hierarchy-scoped attendance, Scrum and request data.
Manager-added Scrum work and blocker resolution run through narrow SECURITY
INVOKER RPCs that preserve the Phase 4 direct-write guard.

See `docs/PHASE_7_MANAGEMENT_QA.md` for the rollback acceptance matrix and
report/export coverage.

## Phase 8 admin gate

Phase 8 — Audit Log & Administrative Settings is protected by
`npm run phase8:check` plus lint, TypeScript and the production build.

The phase exposes the existing immutable audit history and canonical company
settings, schedules, holidays and leave types through Super Admin-only
workflows. Administrative configuration changes are automatically audited, and
audit records are isolated between demo/test and production environments.

The Phase 8 gate also checks that the repository status is normalized to Phases
1–8 complete and that the Settings UI does not expose known-invalid destructive
actions for the default schedule, historical holidays or the final active leave
type.

See `docs/PHASE_8_ADMIN_QA.md` for the rollback acceptance matrix and
configuration-security coverage.
