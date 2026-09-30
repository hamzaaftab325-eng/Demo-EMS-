# eMarketSelect Employee Management System

## Simple Production Plan

**Goal:** Build the complete EMS as a real production system, step by step, with one source of truth for every feature and every piece of data.

**Current position:** Backend foundation is ready. Frontend application implementation is next.

---

## 1. What are we building?

A single internal EMS for eMarketSelect. The current HTML is our visual/workflow reference. The production application will use **Next.js** for the app and **Supabase** for authentication, database, security, and realtime data.

- **Employee:** My Day, scrum, tasks, progress, breaks, meetings, attendance, and requests.
- **Manager:** Team dashboard, live status, scrum board, attendance, employees, approvals, and reports.
- **Super Admin:** Organization control, employee access, settings, audit, and final approvals.

---

## 2. What is completed already?

| Status | What this means |
| --- | --- |
| ✅ DONE — EMS prototype | Main screens and user flows are already defined. |
| ✅ DONE — Requirements | Scrum, attendance, presence, requests, roles, and privacy rules are defined. |
| ✅ DONE — Supabase | Project is connected and working. |
| ✅ DONE — Database | 29 normalized production tables are created. |
| ✅ DONE — Security | RLS is enabled on all public tables; Supabase Security Advisor currently reports 0 issues. |
| ✅ DONE — Configuration | 7 departments, 4 schedules, 5 leave types, company defaults, and realtime tables are prepared. |
| ✅ DONE — Admin profiles | Real Super Admin profile (EMS-001) and demo Super Admin profile (EMS-DEMO-001) are provisioned. |
| 🟠 NEXT — Demo Auth user | Create the password Auth user in Supabase Authentication; it will link automatically to EMS-DEMO-001. |
| ⬜ TODO — Application code | The real Next.js application starts next. |

---

## 3. What is not built yet?

- Login UI and protected app shell.
- Frontend pages connected to real Supabase data.
- Trusted server workflows for approvals, audit, corrections, and leave ledger.
- Real employee import/reporting hierarchy.
- Full QA, pilot, and production rollout.

---

## 4. Final system modules

Each module is built once and reused across roles where needed.

| Module | Main user | What it does |
| --- | --- | --- |
| Authentication | All users | Login, session, active employee check, role, and access scope. |
| My Day | Employee | Sign in, scrum, progress, break, meeting, sign off, and daily timeline. |
| Requests | Employee | Leave, shift change, and hour change requests. |
| Dashboard | Manager/Admin | Team overview, live status, blockers, and approvals. |
| Scrum Board | Manager/Admin | Team scrum, filters, task assignment, and blocker review. |
| Attendance | Manager/Admin | Attendance, hours, breaks, corrections, and exports. |
| Employees | Manager/Admin | Profiles, reporting line, schedule, and employee status. |
| Reports | Manager/Admin | Scrum, attendance, hours, leave, and request reports. |
| Admin | Super Admin | Settings, holidays, imports, audit, and access control. |

---

## 5. Database groups already ready

- **Organization:** departments, profiles, reporting lines, employee status history.
- **Schedules:** work schedules, schedule assignments, holidays, company settings.
- **Attendance:** workdays, attendance events, corrections, work intervals.
- **Presence:** current employee presence and presence history.
- **Scrum:** entries, tasks, daily task links, progress history, obstacles.
- **Requests:** requests, request details, approvals, leave types, leave ledger.
- **System:** notifications, audit logs, imports, import errors.

---

## 6. Build phases — Part 1

We finish and verify each phase before starting the next one.

| Phase | Name | What we build |
| --- | --- | --- |
| 1 | Project foundation | Next.js + TypeScript project, Tailwind/shadcn foundation, environment setup, Supabase clients, routing, shared layout, and clean folder structure. |
| 2 | Authentication | Demo email/password login, protected routes, session handling, profile lookup, and role-aware navigation. |
| 3 | Employee core | Employee list/profile, departments, reporting hierarchy, schedules, and active/deactivated employee state. |
| 4 | My Day + Scrum | Sign-in scrum, backlog/carry-over, task progress, obstacles, break/meeting, sign-off, and sign-back-in. |
| 5 | Attendance + Presence | Attendance engine, live presence, daily timeline, manager live view, and attendance correction workflow. |

### Phase rule

A phase is not complete because the page looks good. It is complete only when:

- UI works.
- Database behavior is correct.
- Permissions are tested.
- There are no blocking console/build errors.

---

## 7. Build phases — Part 2

| Phase | Name | What we build |
| --- | --- | --- |
| 6 | Requests + Approvals | Leave, shift/hour changes, manager approval, final approval, and leave-balance ledger. |
| 7 | Management + Reports | Dashboard, scrum board, employee drill-down, management reports, and CSV exports. |
| 8 | Admin + Audit | Settings, holidays, employee access, imports, audit log, and system controls. |
| 9 | Production QA | Employee/manager/admin role tests, RLS/security tests, edge cases, mobile/tablet/desktop QA, performance, and pilot readiness. |

---

## 8. Rules to prevent duplication

- One database source owns each business fact. Do not save the same value in several tables unless it is an intentional historical snapshot.
- One reusable component for repeated UI patterns such as tables, status pills, cards, filters, and modals.
- One server workflow for sensitive actions; pages do not re-create approval or attendance business logic.
- One permission model. Supabase RLS remains the real security layer.
- One status vocabulary for presence, workday, scrum, and requests.
- One company-settings source for grace period, work target, and approval rules.
- Do not create a second temporary backend. The existing Supabase schema is the canonical database.

---

## 9. Demo vs production access

- **Production account:** EMS-001 is reserved for the future real company Super Admin login.
- **Development account:** EMS-DEMO-001 uses `demo.admin@example.test` only while we build and test.
- **Before launch:** deactivate demo access and switch production authentication to approved company accounts.

---

## 10. What we do next — Phase 1

The next work is only the project foundation and demo authentication. We do not start employee/scrum pages until this is stable.

| Step | Area | Work |
| --- | --- | --- |
| 1 | Repository | Initialize the Next.js + TypeScript project in Demo-EMS-. |
| 2 | UI foundation | Add Tailwind/shadcn, design tokens, typography, and the responsive EMS app shell. |
| 3 | Supabase | Create browser/server Supabase clients with environment variables; never expose service-role secrets. |
| 4 | Authentication | Build login, auth/session handling, and protected application routes. |
| 5 | Demo admin | Create the demo Auth user, verify the EMS-DEMO-001 link, and test Super Admin access. |
| 6 | Navigation | Use one shared role-aware navigation configuration for all three roles. |
| 7 | QA | Build/lint, redirects, login/logout, responsive shell, and baseline security checks. |

---

## 11. Phase 1 is complete only when

- The repo contains a clean production Next.js structure.
- The app builds and runs without blocking errors.
- Demo Super Admin can log in with email/password.
- The Auth user is linked to EMS-DEMO-001.
- Unauthenticated users cannot open protected EMS pages.
- Super Admin scope works through the database/RLS model.
- No secret/service-role key is exposed in frontend code.
- Desktop and mobile app shell are stable.

---

## 12. Decisions to confirm later

- Who can correct attendance besides Super Admin?
- Exact leave balances for each leave type.
- Whether meetings always count as work time.
- Final production approval chain.
- Holiday/weekend policy.
- Whether managers can edit scrum items or only add them.
- Whether employees can edit a submitted sign-in scrum.

---

## 13. Current position

**BACKEND FOUNDATION:** ✅ READY  
**DEMO AUTH USER:** 🟠 NEEDS TO BE CREATED  
**FRONTEND APPLICATION:** ⬜ NOT STARTED  
**NEXT:** Phase 1 — Foundation + Authentication

After Phase 1 passes its exit gate, we continue to Employee Core and then move through the remaining phases one by one.

This document is the simple roadmap and single source of truth for implementation. We will avoid re-designing or duplicating backend work that is already complete.
