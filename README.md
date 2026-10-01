# eMarketSelect EMS

Production Employee Management System for eMarketSelect.

## Current status

**Phases 1–6: COMPLETE AND STABILIZED**

Phase 1 established the production Next.js foundation. Phase 2 added real Supabase authentication and protected role-based access. Phase 3 now connects the organization layer to live Supabase data.

### Phase 3 includes

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

Only the Supabase URL and publishable key belong in browser-visible environment variables. Never expose a Supabase secret/service-role key in `NEXT_PUBLIC_*`.

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
- Super Admin can manage employees.
- Director can see their reporting subtree.
- Manager can see their reporting subtree.
- Employee can see their own scoped data.

The approved roadmap is stored in `docs/EMS_Production_Plan_FINAL.docx`.


## Phase 4

My Day & Scrum is now backed by transactional Supabase workflows:

- Sign in with a required scrum cycle
- Previous signed-off scrum visibility
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

Phase 5 added heartbeat, idle/away detection, official attendance calculations, late/core-hour rules, CSV export, correction auditing, automatic inactivity sign-off, and manager attendance views.

## Phase 5 — Attendance & Presence

Phase 5 is complete and live: heartbeat, idle/away, realtime team presence, attendance calculations, target hours, breaks, meetings, late/core-hour rules, CSV export, correction auditing, automatic inactivity sign-off, and manager Live View.


### Manager visibility after Phase 4

Phase 4 creates the real employee scrum/workday records and RLS already allows managers and directors to read only employees in their reporting subtree.

The dedicated management monitoring UI remains intentionally deferred:
- **Phase 7 — Scrum Board:** team scrum, blockers, progress, filters, and manager-added work.
- Danish can access Hamza, Ghulam, Haider, and Rida once those users have operational records.
- Faisal can access Danish and everyone below Danish.
- Super Admin can access the full organization.

This avoids building a second copy of scrum data: Phase 7 will read the same Phase 4 records.


### Phase 5 production behavior

- Heartbeat sends only a timestamp about once per minute while the EMS app is open.
- Last activity stores only the time of the last click or key press inside EMS, never the content.
- Active: activity within 5 minutes while heartbeat is current.
- Idle: no EMS interaction for 5–15 minutes while heartbeat continues.
- Away: activity is older than 15 minutes or the heartbeat is stale.
- Break and meeting statuses come from the employee's explicit My Day controls.
- Meetings count toward net worked time. Breaks do not.
- Flexible schedules are evaluated against target minutes and are never late.
- Fixed and flexible-core schedules use their configured start/core-start plus grace.
- Automatic sign-off uses the existing 4-hour inactivity setting and preserves unfinished scrum progress.
- Attendance corrections are Super Admin only, require a reason, and write an audit record.
- Presence and attendance are RLS-scoped to self, reporting-chain managers/directors, and Super Admin.

## Phase 6 — Requests & Approvals

Phase 6 is live:

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

## Next phase

**Phase 7 — Management Dashboard & Reports**

Team scrum board, blockers, manager-added work, employee drill-down, richer management reporting and CSV exports.


## Phase 1–6 final audit

The stabilization audit through Phase 6 verifies:

- Authentication/session guards and role-aware navigation
- Employee hierarchy, schedule history and reporting-cycle protection
- My Day transactional scrum workflow, carry-over, progress, breaks, meetings and sign-off
- Presence heartbeat with Active / Idle / Away / Break / Meeting / Signed-off states
- Attendance calculation integrity, manager subtree visibility and employee isolation
- Live View and Attendance status/search/department filters
- Attendance CSV exports that respect the selected filters
- Super Admin attendance corrections with mandatory reason and audit history
- Realtime publication for employee_presence and workdays
- Active Phase 5 cron maintenance jobs
- RLS enabled on every public table and no anonymous write grants
- No duplicate employee codes/emails, active reporting lines, active schedules, workdays or scrum entries

The My Day timeline is adaptive to the actual work session. A late-night sign-in at 10:50 PM now renders an hourly window such as 10 PM → 11 PM → 12 AM instead of stretching the bar across an arbitrary 8-hour range.


### Cross-midnight workdays

An open workday now remains the employee's active My Day after local midnight until it is signed off or automatically signed off for inactivity. Heartbeat, breaks, meetings, obstacles, task additions and sign-off all resolve the same open workday rather than silently creating a second day's session. A partial unique index prevents more than one open workday per employee.

The My Day timeline uses the employee's target work duration as its visible window. For example, an 8:08 AM sign-in on an 8-hour target displays the work window through roughly 5 PM; a 10:50 PM sign-in displays 10 PM, 11 PM, 12 AM and the overnight hours instead of collapsing to a two-hour strip.


## Employee account onboarding

Employee onboarding is part of the trusted Super Admin workflow:

1. Super Admin creates the employee with role, department, manager and schedule.
2. EMS stores a setup/personal contact separately from the planned work login identity.
3. In the demo environment, the setup email is the initial Auth/login identity and receives the one-time **account setup invitation** through the protected `employee-account` Edge Function. Any different work email is stored as pending.
4. The employee opens the latest invite and creates their own password.
5. Database authorization remains blocked until password setup records `auth_activated_at`.
6. If setup is incomplete, **Resend account setup** replaces the incomplete Auth identity and sends a fresh Invite-user email. It does not send a Reset-password email.
7. For the demo workflow, Super Admin can then use **System access → Assign work login email**. Supabase Auth and `profiles.email` change together while the employee's password remains unchanged.
8. After work-email assignment, the employee signs in with the new work/login email plus the same password.
9. Ordinary employee editing cannot change a linked login email; identity changes are restricted to System access.
10. **Forgot password** uses the current work/login email and is accepted only for an activated, active EMS account. Unactivated users must use account setup instead.

The restricted `employee_access_contacts` table stores setup-contact/work-email metadata. Only Super Admin can read it through authenticated RLS; normal employees and reporting managers do not receive those private contact rows.

Mailbox provisioning itself is outside EMS. Production work mailboxes must exist in the company's email platform before they can reliably receive Auth/recovery mail.

### Demo employee deletion

Super Admin can deactivate any non-self employee. Deactivation blocks access but keeps the employee record and history.

For demo/test employees only, Super Admin can also remove the employee from the working directory. EMS archives the original identity and organization snapshot, preserves historical EMS records through the retained inactive profile, releases the original employee code/setup/work emails for reuse, moves any linked Auth identity to an inert tombstone email, and unlinks it from EMS. Deleted employees are shown in the Super Admin archive on the Employees page.

### Professional Auth email templates

Branded invite and password-recovery templates are stored in `supabase/templates/`. Hosted Supabase projects require those templates to be applied in Authentication → Email Templates; see `docs/SUPABASE_AUTH_EMAILS.md`.

The current demo uses custom SMTP. The repository never stores the SMTP credential. Before production, replace the development sender with a verified company sending domain.


### Phase 6 completion hardening

Phase 6 now treats approved leave and approved schedules as canonical operational data rather than display-only overlays:

- Approved leave creates or updates attendance workdays as on_leave with zero scheduled minutes.
- Employees cannot sign in on an approved leave working date.
- Leave cannot be approved after work has already started for an affected date.
- Configured annual/default leave entitlements and ledger allocations are enforced; a NULL entitlement remains an explicit no-quota policy.
- Cross-year leave writes idempotent ledger segments by year.
- Hour-change requests are database-enforced as single-date requests.
- Approved schedule changes update unstarted workdays and cannot rewrite dates where work already started.
- Demo/test and production employee data are isolated at the RLS helper layer.
- Super Admin can reassign stuck manager/final approvals with notifications and audit evidence.
- Request-generated schedules remain selectable when editing the employee who currently uses them.
- A notification center exposes request workflow notifications and read/unread state.
- Phase 6 table grants are reduced to the browser permissions actually required.
- Exposed request RPCs are SECURITY INVOKER wrappers over private privileged implementations.


### Phase 1–6 finalization

Phases 1 through 6 are treated as the stable production foundation before Phase 7 begins:

- Phase 1 — Project Foundation: complete
- Phase 2 — Auth & Access: complete
- Phase 3 — Employees & Company Structure: complete
- Phase 4 — My Day & Scrum: complete
- Phase 5 — Attendance & Live Presence: complete
- Phase 6 — Requests & Approvals: complete

The finalization gate requires a clean lint, TypeScript check, production build, successful Vercel deployment, applied Supabase migrations, RLS on exposed tables, and no direct authenticated writes to protected request/ledger tables.


## Phase 1 foundation gate

The Phase 1 application foundation is protected by `npm run foundation:check`
plus lint, TypeScript and production build in GitHub Actions. The original
29-table foundation snapshot is captured under `supabase/baseline/`; later
phases extend that schema through versioned migrations. Global error
handling and internal-app security headers are enabled, and browser/server
Supabase clients remain separated.

See `docs/PHASE_1_FOUNDATION_QA.md` for the acceptance record.


## Phase 2 authentication gate

Authentication and access are guarded by `npm run auth:check`, the Supabase
session/profile guard, role-aware route checks and PostgreSQL RLS. Account
activation is now part of the database authorization identity: an invite
session cannot access operational EMS data until password setup completes.

See `docs/PHASE_2_AUTH_QA.md` for the acceptance matrix.


## Phase 3 employee access gate

The employee identity/onboarding workflow is protected by `npm run employees:check` plus lint, TypeScript and production build in GitHub Actions. The gate verifies setup/work-email separation, trusted work-login assignment, fresh-invite resend behavior, guarded password recovery, synchronized Supabase types and the versioned access-lifecycle migrations.

See `docs/PHASE_3_EMPLOYEE_ACCESS_QA.md` for the acceptance matrix.
