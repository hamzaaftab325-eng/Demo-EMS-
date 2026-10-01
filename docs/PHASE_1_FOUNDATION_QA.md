# Phase 1 — Project Foundation acceptance record

This document records the Phase 1 foundation gate against the EMS production
blueprint.

## Scope

Phase 1 owns the application foundation only: Next.js + TypeScript, Tailwind /
shadcn foundation, environment contract, Supabase clients, routing, shared
responsive shell, version-controlled database baseline, build conventions and
deployment readiness.

## Acceptance status

| Gate | Status | Evidence |
| --- | --- | --- |
| Next.js + TypeScript application | Complete | App Router, strict TypeScript, Next.js production build |
| Tailwind / shadcn foundation | Complete | Tailwind 4, components.json, shared UI components |
| Environment contract | Complete | .env.example + src/lib/env.ts |
| Browser/server Supabase separation | Complete | src/lib/supabase/client.ts and server.ts |
| Privileged key isolation | Complete | no service-role/secret key in browser/repository source |
| Typed database | Complete | src/types/database.ts |
| Canonical schema baseline in Git | Complete | supabase/baseline/20261001_phase1_schema_snapshot.sql |
| Protected-route foundation | Complete | src/proxy.ts + session proxy |
| Shared role-aware app shell | Complete | responsive sidebar/header/navigation |
| Failure states | Complete | loading, route error, root global error and 404 |
| Internal-app indexing protection | Complete | robots metadata + X-Robots-Tag |
| Baseline security headers | Complete | no-sniff, frame deny, referrer and permissions policy |
| Automated quality gate | Complete | foundation check, lint, typecheck and production build |
| Vercel deployment | Complete when main status is green | verified through GitHub/Vercel status checks |
| Repository visibility | **Account setting required** | GitHub repository must be changed from Public to Private |

## Non-negotiable repository rule

The EMS is an internal workforce application. GitHub repository visibility must
be **Private**. The application contains no committed service-role secrets, but
making the repository private is still part of the approved Phase 1 blueprint.

## Regression gate

Run:

```bash
npm run foundation:check
npm run lint
npm run typecheck
npm run build
```

All four commands must pass before Phase 1 foundation changes are merged.
