# eMarketSelect EMS

Production Employee Management System for eMarketSelect.

## Current status

**Phase 1 — Project Foundation**

This repository contains the Next.js application foundation, shared EMS shell, Supabase SSR clients, generated database types, route placeholders, and CI checks.

## Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4 + shadcn-compatible component structure
- Supabase PostgreSQL, Auth, RLS and Realtime
- Vercel target deployment

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the project's Supabase publishable key.
3. Run `npm install`.
4. Run `npm run dev`.

Never expose a Supabase secret/service-role key in `NEXT_PUBLIC_*`.

The approved roadmap is stored in `docs/EMS_Production_Plan_FINAL.docx`.


## Deployment

Phase 1 foundation is ready for Vercel production deployment from the `main` branch.
