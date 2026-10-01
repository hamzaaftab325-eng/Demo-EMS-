# Phase 6 — Requests & Approvals QA

## Scope

Phase 6 covers employee leave, shift-change and hour-change requests; manager/final approval; cancellation and rejection; leave balances; schedule application; request notifications; approval reassignment; attendance synchronization; audit evidence; and least-privilege authorization.

## Completion defect found and fixed

A live rollback test reproduced a cross-year leave failure. The original Phase 6 core created `leave_ledger_approved_request_uidx`, which allowed only one approved-leave ledger row per request. Phase 6 hardening later segmented approved leave by calendar year. A Dec → Jan leave therefore failed final approval on the second ledger row.

Migration `20261001174317_phase6_cross_year_leave_ledger_fix.sql` removes the obsolete single-row index and retains `leave_ledger_request_year_effect_unique`, which makes each year segment idempotent.

## Live rollback acceptance

All mutating scenarios below were executed inside transactions and rolled back. No QA employee, request, approval, ledger, notification or schedule data was retained.

| Scenario | Result |
| --- | --- |
| Leave submit → manager approval → final Super Admin approval | PASS |
| Final leave state, two approval stages, audit evidence | PASS |
| Approved leave ledger deduction | PASS |
| Approved leave creates canonical `on_leave` workday with 0 scheduled minutes | PASS |
| Approved leave blocks attendance sign-in at database trigger level | PASS |
| Pending request cancellation with reason | PASS |
| Rejection requires a comment | PASS |
| Rejection notification/state | PASS |
| Repeated/duplicate decision rejected | PASS |
| Leave allocation limit enforced | PASS |
| Pending leave reserves remaining balance | PASS |
| Hour change restricted to one date | PASS |
| Temporary shift change applies fixed schedule and restores prior assignment | PASS |
| Permanent shift change replaces future schedule from effective date | PASS |
| Manager can read only their reporting subtree | PASS |
| Authenticated direct insert into protected requests table | BLOCKED |
| Notification read update for own recipient row | PASS |
| Non-Super-Admin approval reassignment | BLOCKED |
| Reassignment to manager outside employee chain | BLOCKED |
| Valid Super Admin reassignment + old/new approver notifications | PASS |
| Cross-year leave final approval after fix | PASS — two year ledger segments |

## Authorization and schema checks

- RLS is enabled on all Phase 6 public tables.
- Normal authenticated clients receive read access only to scoped request/approval/ledger rows.
- Normal authenticated clients do not receive direct insert/update/delete rights on protected request workflow tables.
- Notification write access is limited to `is_read` and `read_at`, with recipient RLS.
- Public request RPCs are SECURITY INVOKER wrappers.
- Privileged implementations live in the private schema and perform current-profile/role checks.
- Manager approvals validate current management scope.
- Final approval requires Super Admin unless the manager-stage approver is already Super Admin.
- Self-approval is rejected.
- Test/demo and production profiles are isolated by the shared environment helper.

## Regression gate

Run:

```bash
npm run requests:check
```

GitHub Actions runs this gate before lint, TypeScript and the production build.

## Exit status

**Phase 6 — Requests & Approvals: 100% complete.**
