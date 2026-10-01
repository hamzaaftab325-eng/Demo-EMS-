# Phase 3 — Employee Access & Onboarding QA

Date: 2026-10-01

## Scope

This gate covers the employee identity and account-access lifecycle that sits
inside Phase 3 Employees & Company Structure:

- employee creation
- setup/personal email
- current login identity
- account setup invitation
- account activation after password creation
- account-setup resend
- work/login email assignment
- normal employee profile editing
- password recovery
- deactivation compatibility
- RLS and audit evidence

Mailbox provisioning itself is not an EMS database function. Google Workspace,
Microsoft 365, or another company mail system remains responsible for creating
a real production mailbox. EMS owns the application login identity and access
lifecycle.

## Final identity model

`public.profiles.email` is the current Supabase Auth login email.

`public.employee_access_contacts` stores restricted access-contact metadata:

- `personal_email` — setup/onboarding contact retained separately
- `work_email` — assigned work/login identity when applicable
- `work_email_assigned_at` — assignment timestamp

The table is RLS-protected and authenticated clients receive SELECT only.
Only Super Admin can read rows through policy. Normal employees and reporting
managers cannot read this private contact table.

## Demo onboarding flow

1. Super Admin creates an employee with a deliverable setup email.
2. EMS creates the employee profile and access-contact record.
3. The protected `employee-account` Edge Function sends an Invite-user email.
4. The employee creates their own password.
5. EMS records `auth_activated_at`; operational access remains blocked before
   this point.
6. If setup is incomplete, Super Admin can resend account setup. EMS replaces
   the incomplete Auth identity and sends a fresh Invite-user email.
7. After activation, Super Admin can assign a work login email in System access.
8. Supabase Auth and `profiles.email` change together.
9. The employee keeps the password already created and signs in using the new
   work/login email.
10. Future password recovery goes to the current login email.

## Password recovery

The public `employee-password-recovery` Edge Function returns the same generic
response for all addresses. It only calls Supabase password recovery when the
matching EMS profile:

- exists
- has an Auth identity
- has completed activation
- is active
- is not deactivated

An incomplete onboarding account therefore cannot use Forgot Password as an
alternate activation path.

## Trusted identity changes

A linked Auth login email cannot be changed through the ordinary employee edit
RPC. The database raises:

`Login email changes must use System access.`

Work/login email assignment is service-role-only and is invoked only from the
JWT-protected `employee-account` Edge Function after a Super Admin session is
validated. The workflow:

1. validates employee state/environment and email rules
2. updates the Supabase Auth email
3. updates the EMS profile/access-contact identity
4. writes audit evidence
5. restores the previous Auth email if the database identity update fails

## Database acceptance tests

The following checks were executed against the live Supabase project.

| Test | Expected | Result |
| --- | --- | --- |
| Super Admin reads access-contact rows through RLS | Visible | PASS — 2 visible demo rows |
| Normal employee reads access-contact rows | Hidden | PASS — 0 visible rows |
| Authenticated browser calls work-email service RPC | Blocked | PASS — permission denied |
| Ordinary employee edit attempts linked login-email change | Blocked | PASS — System access guard |
| Work email collides with another employee identity | Blocked | PASS |
| Existing employee edit with active manager and schedule | Succeeds | PASS |
| Work-email transition updates profile + access-contact + audit | Atomic | PASS in rollback transaction |
| Rollback test leaves real employee login unchanged | Unchanged | PASS |
| Access-contact browser grants | SELECT only | PASS |
| Access-contact RLS | Enabled, Super Admin SELECT policy | PASS |

## Edge Function acceptance

### employee-account

- JWT verification enabled
- active Super Admin required
- same demo/production environment required
- first setup uses `inviteUserByEmail`
- incomplete setup resend uses a fresh invite
- onboarding contains no `resetPasswordForEmail`
- work-email assignment uses Supabase Admin `updateUserById`
- employee password is never set or exposed by the administrator
- work-email database write is service-role-only

### employee-password-recovery

- intentionally public because password recovery starts before authentication
- returns a generic anti-enumeration response
- checks EMS activation/status with the privileged server client
- only then requests Supabase password recovery
- redirect is pinned to the hosted EMS `/set-password` route

## Data-integrity controls

- setup emails unique case-insensitively
- work emails unique case-insensitively
- cross-employee personal/work/login collisions blocked
- production work identities restricted by existing company-domain rules
- reporting-line cycle protection remains enforced by the
  `reporting_lines_prevent_cycle` database trigger
- work-email changes audited
- employee status history remains intact

## Email delivery

Custom SMTP is configured on the hosted Supabase project for current demo
testing. The repository stores branded Invite-user and Reset-password HTML
sources under `supabase/templates/`; SMTP credentials are not committed.

Hosted Supabase Auth email template subject/body configuration is a platform
setting and is documented in `docs/SUPABASE_AUTH_EMAILS.md`.

## Automated regression gate

`npm run employees:check` verifies that:

- the account setup function does not use password recovery
- setup/work email fields remain separate
- System access exposes work-login assignment
- the guarded password-recovery endpoint remains in use
- direct browser Forgot Password does not bypass the EMS activation guard
- generated Supabase types include the access-contact table/service workflow
- required migrations remain versioned

GitHub CI runs this before lint, TypeScript and the production build.

## Platform hardening outside this code gate

Supabase Security Advisor still reports **Leaked Password Protection Disabled**.
This is an Auth project setting, not a schema/application implementation gap.
Enable it before production rollout.

The repository visibility is also an account-level GitHub setting and should be
Private for production if it is still public.
