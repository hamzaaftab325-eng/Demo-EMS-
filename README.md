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
- Users must exist in Supabase Auth and be linked to an active `public.profiles` row.
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

**Phase 5 — Attendance & Presence**

Phase 5 will make official attendance calculations and realtime status live: heartbeat, idle/away, attendance status, target hours, break totals, late/core-hour rules, attendance corrections, and the management Live View.


### Manager visibility after Phase 4

Phase 4 creates the real employee scrum/workday records and RLS already allows managers and directors to read only employees in their reporting subtree.

The dedicated management monitoring UI remains intentionally deferred:
- **Phase 7 — Scrum Board:** team scrum, blockers, progress, filters, and manager-added work.
- Danish can access Hamza, Ghulam, Haider, and Rida once those users have operational records.
- Faisal can access Danish and everyone below Danish.
- Super Admin can access the full organization.

This avoids building a second copy of scrum data: Phase 7 will read the same Phase 4 records.
