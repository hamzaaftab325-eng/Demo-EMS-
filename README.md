# eMarketSelect EMS

Production Employee Management System for eMarketSelect.

## Current status

**Phase 4 — My Day & Scrum: COMPLETE**

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

## Demo organization

- Rayan Enzo — Super Admin / CEO — `demo.admin@example.test`
- Faisal Ahmed Siddiqui — Director — `director1@example.test`
- Danish Mehmood — Manager — `manager1@example.test`
- Hamza Aftab — UX Designer & Front-End Developer — `employee1@example.test`
- Ghulam — UX Designer & Front-End Developer — `employee2@example.test`
- Haider Razaq — Jr. Full-Stack Developer — `employee3@example.test`
- Rida-e-Ayesha — UX Designer & Front-End Coordinator — `employee4@example.test`

Rayan Enzo currently has a Supabase Auth identity. Other demo profiles are linked automatically when matching Auth users are created; no duplicate employee records are needed.

## Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4 + approved EMS prototype design system
- Supabase PostgreSQL, Auth, RLS and Realtime
- Vercel deployment from `main`

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Run `npm ci`.
3. Run `npm run dev`.

Only the Supabase URL and publishable key belong in browser-visible environment variables. Never expose a Supabase secret/service-role key in `NEXT_PUBLIC_*`.

## Authentication and authorization

- Public sign-up is intentionally disabled.
- Super Admin creates the employee profile first and can send a secure invitation from EMS.
- The invite creates/links the Supabase Auth identity by employee email.
- The employee opens the one-time link, chooses their own password, and EMS records account activation.
- Existing employees can use Forgot Password to request a new setup link.
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

Phase 5 will add heartbeat, idle/away detection, official attendance calculations, late/core-hour rules, and manager attendance views.


## Next

**Phase 5 — Attendance & Presence: COMPLETE**

Phase 5 is live: heartbeat, idle/away, realtime team presence, attendance calculations, target hours, breaks, meetings, late/core-hour rules, CSV export, correction auditing, automatic inactivity sign-off, and manager Live View.


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

## Next phase

**Phase 6 — Requests & Approvals**

Leave, shift-change and hour-change requests, manager/final approval, leave ledger impact, schedule changes, notifications, and audited decisions.


## Phase 1–5 final audit

The stabilization audit completed after Phase 5 verifies:

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

Employee onboarding is now part of the Super Admin employee workflow:

1. Super Admin creates the employee with role, department, manager and schedule.
2. EMS persists the employee profile before any Auth identity is created.
3. When **Send login invitation** is enabled, the JWT-protected `employee-account` Edge Function verifies the caller is Super Admin.
4. Supabase Auth sends the employee a one-time invitation email.
5. The Auth-user trigger links that identity to the existing employee profile by email; no duplicate employee profile is created.
6. The employee opens the link at `/set-password` and chooses a password. The Auth-user trigger records `auth_activated_at` only after a password is actually set.
7. Unactivated accounts are redirected to password setup instead of entering the EMS application.
8. If setup is incomplete, Super Admin can **Resend setup link**. Existing users also have **Forgot password** on the login page.

The Supabase privileged secret is used only inside the Supabase Edge Function and is never exposed to Vercel browser code or any `NEXT_PUBLIC_*` variable. The function prefers Supabase's modern secret key environment and retains the legacy service-role variable only as a compatibility fallback.

Demo addresses under `@example.test` can link correctly but cannot receive real email. Demo/test profiles may use another real mailbox for delivery testing; production profiles remain restricted to `@emarketselect.com`.


### Professional Auth email templates

Branded invite and password-recovery templates are stored in `supabase/templates/`. Hosted Supabase projects require those templates to be pasted into Authentication → Email Templates; see `docs/SUPABASE_AUTH_EMAILS.md`.

The built-in Supabase mailer is for demo testing and only sends to addresses authorized as members of the Supabase organization. Production employee delivery requires custom SMTP.
