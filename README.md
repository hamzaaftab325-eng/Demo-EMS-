# eMarketSelect EMS

Production Employee Management System for eMarketSelect.

## Current status

**Phase 3 — Employees & Company Structure: COMPLETE**

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

- Demo CEO — Super Admin — `demo.admin@example.test`
- Faisal Ahmed Siddiqui — Director — `director1@example.test`
- Danish Mehmood — Manager — `manager1@example.test`
- Hamza Aftab — UX Designer & Front-End Developer — `employee1@example.test`
- Ghulam — UX Designer & Front-End Developer — `employee2@example.test`
- Haider Razaq — Jr. Full-Stack Developer — `employee3@example.test`
- Rida-e-Ayesha — UX Designer & Front-End Coordinator — `employee4@example.test`

Only the Demo CEO currently has a Supabase Auth identity. The remaining demo people are real EMS profiles and can receive Auth identities later without duplicating their employee records.

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
