# Phase 5 — Attendance & Live Presence QA

Date: 2026-10-01

## Scope

Phase 5 is complete when EMS can derive reliable attendance and live presence from the Phase 4 workday lifecycle without duplicating employee time data.

Covered behavior:

- heartbeat and EMS-tab activity timestamps
- Active → Idle → Away transitions
- Break and Meeting states
- official gross, break, meeting and net worked minutes
- fixed, flexible and flexible-core schedule rules
- grace-period lateness and early-leave calculations
- automatic inactivity sign-off
- cross-midnight workday continuity
- stale previous-day presence rollover
- manager/director reporting-scope isolation
- Super Admin attendance corrections with audit evidence
- Attendance filters and scoped CSV export
- Realtime Live View updates

## Root causes fixed during final audit

1. **Cross-midnight Live View**
   Live View previously selected only the employee's current local date, so an open workday that began before midnight could disappear from management views. Live data now resolves the workday referenced by current presence and preserves it while its status is working, on break, or in meeting.

2. **Stale previous-day signed-off presence**
   A signed-off workday from a previous local date could remain attached to presence. Phase 5 maintenance now clears that stale workday reference and returns the employee to Offline while preserving genuinely open overnight workdays.

3. **Super Admin attendance correction**
   The correction workflow needed trusted permission to create a missing workday and append the correction attendance event. The workflow-only database guards remain in place, so those broader RLS policies cannot be used for arbitrary direct client writes.

4. **Correction invariants**
   Historical correction creation now requires a first sign-in and final sign-off, rejects future dates, rejects a final sign-off before first sign-in, and remains same-environment scoped through profile RLS.

5. **Private helper least privilege**
   Temporary helper execution needed during diagnosis was removed again after the correction RPC was adjusted to rely on the existing RLS boundary.

## Live rollback acceptance tests

All data-changing tests were executed inside PostgreSQL transactions and rolled back.

| Test | Expected | Result |
| --- | --- | --- |
| Active presence | Recent heartbeat + activity → Active | PASS |
| Idle presence | 10 minutes without EMS interaction → Idle | PASS |
| Away presence | 20 minutes without EMS interaction → Away | PASS |
| Break / meeting math | 540 gross − 60 break = 480 net; 30 meeting remains worked time | PASS |
| Fixed schedule lateness | 09:20 on 09:00 + 15 minute grace → 5 minutes late | PASS |
| Flexible schedule | Arbitrary sign-in time → 0 late minutes | PASS |
| Flexible-core lateness | 12:25 on 12:00 + 15 minute grace → 10 minutes late | PASS |
| Automatic inactivity sign-off | Open workday closes and creates auto_sign_off event | PASS |
| Super Admin correction | Correct another employee and create a missing attendance day | PASS |
| Invalid historical correction | Missing first sign-in rejected | PASS |
| Manager subtree | Direct child + grandchild visible; unrelated employee hidden | PASS |
| Stale previous-day signed-off presence | Workday reference cleared; status becomes Offline | PASS |
| Open overnight workday | Previous-date open workday remains attached and Active | PASS |

## Live infrastructure verification

Verified on the connected Supabase project:

- all Phase 5 migrations are applied
- RLS is enabled on attendance/presence tables
- `employee_presence` and `workdays` are published to Realtime
- `ems-phase5-presence-maintenance` runs every minute
- `ems-phase5-daily-attendance-maintenance` runs hourly at minute 15
- recent executions of both cron jobs succeeded

## Regression gate

`npm run attendance:check` verifies the application and migration contracts for:

- heartbeat/activity tracking
- cross-midnight Live View selection
- stale presence isolation
- Live View realtime/search/status/department filters
- Attendance filters and correction UI
- CSV export scope/filter propagation
- attendance calculations
- fixed/flexible/flexible-core rules
- auto sign-off
- one-open-workday protection
- correction authorization and chronology guards
- least-privilege private helper cleanup

GitHub Actions runs this gate before lint, TypeScript and the production build.

## Exit status

**Phase 5 — Attendance & Live Presence: COMPLETE for the EMS demo.**

The Phase 5 implementation is live, permission-scoped, rollover-safe, correction-safe and regression-gated.
