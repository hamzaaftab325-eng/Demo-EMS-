# EMS Auth Email Setup

The application-side invitation, activation and recovery flow is implemented in the repository.

## Demo sender behavior

Supabase's built-in SMTP service is intended only for testing. It only delivers Auth email to addresses that are members of the Supabase organization team. Addresses under `@example.test` are intentionally non-deliverable.

For a demo email test, a demo/test employee may use any syntactically valid real mailbox. The mailbox must also be an authorized member of the Supabase organization when using the built-in sender. Production employees remain restricted to `@emarketselect.com`.

## Hosted invite template

In Supabase Dashboard → Authentication → Email Templates → Invite user:

**Subject**

`Activate your eMarketSelect EMS account`

Paste the contents of:

`supabase/templates/invite.html`

## Hosted recovery template

In Supabase Dashboard → Authentication → Email Templates → Reset password:

**Subject**

`Reset your eMarketSelect EMS password`

Paste the contents of:

`supabase/templates/recovery.html`

## Redirect configuration

In Supabase Dashboard → Authentication → URL Configuration:

**Site URL**

`https://demo-ems-ten.vercel.app`

**Production redirect URL**

`https://demo-ems-ten.vercel.app/set-password`

Employee invitations are always generated against the hosted EMS domain. Supabase verifies the invitation on the allow-listed `/set-password` callback, then the application presents the employee-facing `/signup` activation URL.

For local recovery testing only, you may also allow:

`http://localhost:3000/set-password`

Do not use localhost as the hosted project's Site URL.

## Production

Before production rollout, replace the demo SMTP sender with a custom SMTP provider so employee mailboxes outside the Supabase organization team can receive invitations and password reset emails.


## Built-in email rate limit

Supabase's hosted built-in Auth email sender is for development/demo use only.
It currently allows only 2 Auth emails per hour per project and only delivers
to email addresses authorized for the Supabase organization.

EMS maps provider rate-limit failures to `email_rate_limited` and keeps the
employee profile intact without falsely creating or activating a login.

For reliable employee invitations in production, configure custom SMTP under
Supabase Authentication → Emails → SMTP Settings.
