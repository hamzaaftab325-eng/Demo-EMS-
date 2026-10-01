# Phase 2 — Authentication & Access acceptance record

Phase 2 owns login/logout, session verification, profile resolution, account
activation state, inactive-user blocking, role-aware navigation, protected
routes and the RLS identity boundary.

## Acceptance status

| Gate | Status | Evidence |
| --- | --- | --- |
| Supabase password login | Complete | Server action uses signInWithPassword |
| Logout/session termination | Complete | Supabase signOut + login redirect |
| Demo Super Admin linked | Complete | EMS-DEMO-001 is linked to its Auth identity |
| Active profile resolution | Complete | Auth claim → profiles.auth_user_id lookup |
| Unlinked identity denied | Complete | Access-denied profile state |
| Deactivated identity denied | Complete | App guard + RLS identity helper |
| Unactivated identity denied operational access | Complete | RLS requires auth_activated_at |
| Invite activation route | Complete | Unactivated accounts consistently use /signup |
| Protected application routes | Complete | Proxy + authenticated app layout |
| Role-aware navigation | Complete | Employee, Manager, Director, Super Admin config |
| Management/admin page guards | Complete | requireRole on restricted routes |
| Safe post-login redirects | Complete | Internal application allow-list |
| Employee RLS scope | Complete | Rollback QA: self only |
| Manager RLS scope | Complete | Rollback QA: self + reporting subtree |
| Director RLS scope | Complete | Rollback QA: full reporting subtree |
| Super Admin environment isolation | Complete | Demo cannot read production-environment profile |
| Unactivated/deactivated RLS block | Complete | Own identity only; no shared operational data |
| Anonymous database access | Complete | No public-table grants to anon |
| CI regression gate | Complete | npm run auth:check + lint + typecheck + build |

## RLS design

`private.current_profile_id()` and `private.current_app_role()` return an
operational EMS identity only when the linked profile is active, not
deactivated, and has completed account activation.

A separate SELECT policy allows an authenticated identity to read its own
`profiles` row even when activation is pending or the profile is deactivated.
This is intentionally narrow: it lets the application explain the user's
state, while all operational RLS helpers still return no EMS identity.

## Rollback QA matrix

The Phase 2 database QA was run inside a transaction and rolled back:

- Employee → only self.
- Manager → self + direct/subordinate scope.
- Director → self + management subtree.
- Unactivated identity → own profile only, no departments/operational identity.
- Deactivated identity → own profile only, no departments/operational identity.
- Demo Super Admin → no production-environment profile visibility.

No synthetic QA identity or record was committed.
