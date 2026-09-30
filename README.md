# eMarketSelect EMS

Production Employee Management System for eMarketSelect.

## Current status

**Phase 2 — Authentication & Access**

The production Next.js foundation is in place. Phase 2 adds Supabase password authentication, cookie-based SSR sessions, active employee/profile validation, role-aware navigation, protected application routes, and server-side role guards.

## Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4 + the approved EMS prototype design system
- Supabase PostgreSQL, Auth, RLS and Realtime
- Vercel target deployment

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Run `npm ci`.
3. Run `npm run dev`.

Only the Supabase URL and publishable key belong in browser-visible environment variables. Never expose a Supabase secret/service-role key in `NEXT_PUBLIC_*`.

## Authentication

- Public sign-up is intentionally disabled in the application.
- Users must exist in Supabase Auth and be linked to an active row in `public.profiles`.
- Application roles come from `public.profiles.role`, not user-editable Auth metadata.
- RLS remains the final authorization layer for database records.
- The development account is `demo.admin@example.test` and maps to `EMS-DEMO-001` after the Auth user is created.

The approved roadmap is stored in `docs/EMS_Production_Plan_FINAL.docx`.
