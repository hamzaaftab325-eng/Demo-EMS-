# Phase 4 — My Day & Scrum QA

Date: 2026-10-01

## Scope

Phase 4 is complete when an employee can complete the full daily My Day
workflow with real Supabase data:

- sign in with Scrum
- see previous work and unfinished/backlog candidates
- carry unfinished work into the current cycle
- add new cycle and backlog items
- update progress percentages
- report obstacles
- start and end breaks/meetings
- sign off with final percentages and notes
- complete items at 100%
- carry items below 100% forward
- sign back in without losing earlier attendance events

Phase 7 owns the dedicated manager Scrum Board, blocker monitoring, filters and
manager-added team work. Phase 4 only creates and protects the canonical
employee Scrum records those later screens consume.

## Architecture

The browser does not construct the workflow with scattered table mutations.
The page uses named My Day RPC workflows:

- `my_day_sign_in`
- `my_day_update_progress`
- `my_day_add_cycle_item`
- `my_day_add_obstacle`
- `my_day_start_interval`
- `my_day_end_interval`
- `my_day_sign_off`
- `my_day_sign_back_in`
- `my_day_get_state`

All mutations resolve the current active EMS profile from the authenticated
session. Phase 4 table triggers reject raw authenticated workflow writes unless
the trusted My Day workflow is executing.

## Data invariants verified

- one workday per employee/work date
- one open workday per employee
- one Scrum entry per workday
- one Scrum item link per Scrum entry/item pair
- one active break/meeting interval per workday
- progress and final percentages constrained to 0–100
- completed intervals require an end timestamp
- completed Scrum items require `completed_at`
- carry-over links preserve prior `scrum_entry_items` lineage

## Live rollback acceptance tests

All tests below were executed against the connected Supabase project inside
transactions that were rolled back. No production/demo workday data was
changed by the tests.

| Test | Expected | Result |
| --- | --- | --- |
| Update current Scrum progress | Latest progress becomes 61% | PASS |
| Add during-day blocker | Blocker stored on active Scrum | PASS |
| Start break | Workday = on_break; one interval active | PASS |
| End break | Workday = working; no interval active | PASS |
| Sign off at 80% | Item remains active for carry-over | PASS |
| Sign back in | Workday working; Scrum reopened; earlier events preserved | PASS |
| Sign off at 100% | Item becomes completed | PASS |
| Duplicate sign off | Second call creates no duplicate side effects | PASS |
| Raw authenticated Scrum insert | Rejected by workflow-only trigger | PASS |
| Normal employee reads another employee Scrum | Zero rows visible | PASS |
| Normal employee resolves own My Day state | Own profile returned | PASS |

The live state also contains a non-null `carried_from_entry_item_id`, proving
that the current Scrum item is linked to its previous-cycle entry rather than
being recreated as unrelated sample data.

## Sign-back-in history

Sign off appends a `sign_off` attendance event. Sign back in changes the same
workday from `signed_off` to `working`, reopens the same Scrum entry and
appends a separate `sign_back_in` event. It does not delete or rewrite the
earlier sign-in/sign-off attendance history.

## 100% / carry-forward rule

At sign off:

- final percentage = 100 → canonical Scrum item becomes `completed`
- final percentage < 100 → canonical Scrum item remains `active`
- active/backlog items are returned by the next My Day state as selectable
  candidates
- when selected into the next cycle, `carried_from_entry_item_id` records
  the prior cycle lineage and the latest percentage becomes the starting value

## Breaks and meetings

Break and meeting actions share the same workday and use
`work_intervals`. A partial unique index allows only one active interval.
Starting a second interval while one is active is rejected. Sign off
automatically closes an active interval before closing the workday.

## Cross-midnight continuity

Later attendance hardening preserves an already-open workday across local
midnight through `private.active_workday_id`, and a partial unique index
prevents a second open workday for the same employee. My Day task changes,
obstacles, intervals, heartbeat and sign off continue to resolve the same open
workday.

## Permission verification

Phase 4 RLS is scoped through the shared EMS authorization helpers:

- Employee: own My Day/Scrum
- Manager/Director: reporting-scope read access for later management screens
- Super Admin: organization-wide read scope
- employee mutations remain ownership-checked by the workflow functions
- raw authenticated workflow writes are blocked by Phase 4 guard triggers

A rollback RLS test temporarily mapped the demo Auth identity to a normal
employee profile. That employee could load their own My Day state and could
see zero Scrum items belonging to the Super Admin.

## Automated regression gate

`npm run myday:check` verifies:

- protected My Day route and canonical state loader
- all Phase 4 server workflow actions
- previous/carry-over/backlog UI
- progress, obstacles, break, meeting, sign-off and sign-back-in controls
- timeline/event history
- 100% completion and <100% carry-forward rules in migrations
- one-active-interval protection
- workflow-only database guards
- cross-midnight one-open-workday protection

GitHub CI runs this gate before lint, TypeScript and the production build.

## Exit status

**Phase 4 — My Day & Scrum: COMPLETE for the EMS demo.**

The employee daily-work lifecycle is functional, persisted, permission-scoped
and regression-gated. No Phase 7 management UI is required to satisfy the
Phase 4 exit gate.
