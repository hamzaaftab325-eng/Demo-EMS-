# Phase 7 — Management Dashboard, Scrum Board & Reports QA

## Scope

Phase 7 turns the existing Phase 4–6 operational records into scoped management tooling. It does not duplicate Scrum, attendance, request or employee records.

The completed scope includes:

- live management dashboard summaries
- dedicated team Scrum Board
- manager-assigned Scrum backlog work
- manager blocker resolution
- attendance and hours reporting
- Scrum/productivity reporting
- leave/request reporting
- filterable 90-day report ranges
- attendance, Scrum and requests CSV exports
- manager/director/Super Admin reporting-scope enforcement
- responsive desktop/tablet/mobile presentation
- realtime updates for Scrum progress and blockers

## Architecture

The management data layer reads only from existing operational tables:

- `workdays`
- `scrum_entries`
- `scrum_entry_items`
- `scrum_items`
- `scrum_item_progress`
- `scrum_obstacles`
- `requests`
- `leave_request_details`

Employee scope comes from the existing organization directory, which is already protected by hierarchy RLS. The manager's own profile is excluded from team reporting rows.

Phase 7 manager writes do not bypass Phase 4's direct-write guard. They use two SECURITY INVOKER RPCs:

- `phase7_assign_scrum_task`
- `phase7_resolve_scrum_obstacle`

Each RPC validates the active EMS profile and management hierarchy, enables the existing `app.phase4_workflow` flag only for the protected operation, and explicitly resets it before returning or rethrowing an error.

## Live rollback acceptance

All mutating scenarios below were executed inside a transaction and rolled back. No Phase 7 QA employees, workdays, Scrum items, blockers or requests remain.

| Scenario | Result |
| --- | --- |
| Manager reads direct-child workday/report row | PASS |
| Manager cannot read outsider workday/report row | PASS |
| Manager reads direct-child Scrum entry/progress | PASS |
| Manager cannot read outsider Scrum entry/progress | PASS |
| Manager assigns backlog task to managed employee through Phase 7 RPC | PASS |
| Manager assignment to outsider | BLOCKED |
| Manager resolves managed employee blocker through Phase 7 RPC | PASS |
| Manager resolution of outsider blocker | BLOCKED |
| Direct manager write to protected Scrum table | BLOCKED |
| Manager write to employee progress history | BLOCKED |
| Assignment RPC resets Phase 4 workflow flag | PASS |
| Blocker RPC resets Phase 4 workflow flag | PASS |

## Realtime

The existing realtime publication already covered Scrum entries, items and obstacles. Phase 7 additionally publishes:

- `scrum_entry_items`
- `scrum_item_progress`

This allows manager views to refresh on task membership and progress changes instead of requiring a manual reload.

## Dashboard acceptance

The dashboard now shows real Scrum progress and blocker totals and no longer contains a Phase 7 placeholder. Realtime subscriptions cover presence, workdays, requests/approvals and all Scrum state used by the dashboard.

## Scrum Board acceptance

The Scrum Board includes:

- date, employee, department, state and search filters
- active/sign-off/not-started/on-leave/blocked visibility
- task-by-task current percentage
- aggregate employee Scrum progress
- break, meeting, net and target context
- open and resolved blockers
- blocker resolution with mandatory note
- manager-assigned backlog work
- empty states and responsive layouts

## Reports acceptance

The Reports page includes:

1. Attendance & hours
2. Scrum productivity
3. Leave & requests

Filters include date range, employee, department, attendance status, request status and search. Ranges are capped at 90 days for predictable demo performance.

Three scoped CSV exports use the same hierarchy-aware data source:

- Attendance CSV
- Scrum CSV
- Requests CSV

Employees cannot access the report export route.

## Regression gate

Run:

```bash
npm run phase7:check
```

GitHub Actions runs this after the Phase 6 gate and before lint, TypeScript and the production build.

## Exit criteria

Phase 7 is complete only when:

- live rollback authorization tests pass
- `npm run phase7:check` passes
- lint passes
- TypeScript passes
- production build passes
- production deployment succeeds

