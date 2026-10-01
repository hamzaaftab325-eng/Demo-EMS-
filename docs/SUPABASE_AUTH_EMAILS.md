# EMS Auth Email Setup

The application-side invitation, activation and recovery flow is implemented in the repository.

## Demo sender behavior

Supabase's built-in SMTP service is intended only for testing. It only delivers Auth email to addresses that are members of the Supabase organization team. Addresses under `@example.test` are intentionally non-deliverable.

For a demo email test, use a real `@emarketselect.com` mailbox that is also an authorized member of the Supabase organization, or add the intended test mailbox to the organization team.

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

In Supabase Dashboard → Authentication → URL Configuration, ensure the production EMS URL is allowed:

`https://demo-ems-ten.vercel.app/set-password`

For local testing, add:

`http://localhost:3000/set-password`

## Production

Before production rollout, replace the demo SMTP sender with a custom SMTP provider so employee mailboxes outside the Supabase organization team can receive invitations and password reset emails.
