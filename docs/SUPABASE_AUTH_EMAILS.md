# EMS Auth Email Setup

The EMS application has separate account-setup and password-recovery flows.

## Current demo SMTP

The hosted Supabase project uses custom SMTP for the current demo test. The
sender is configured as `eMarketSelect EMS Demo <onboarding@resend.dev>`.

This Resend development sender is for testing only. It must be replaced with a
verified company sending domain before production rollout.

## Account setup email

Supabase Dashboard → Authentication → Email Templates → **Invite user**

**Subject**

`Welcome to eMarketSelect EMS — Set Up Your Account`

Paste the contents of:

`supabase/templates/invite.html`

This template is used for both the first employee invitation and an
administrator resend while account setup is still incomplete. The EMS resend
workflow creates a fresh invite instead of using password recovery, so the
employee never receives a misleading "Reset your password" message during
onboarding.

## Password recovery email

Supabase Dashboard → Authentication → Email Templates → **Reset password**

**Subject**

`Reset Your eMarketSelect EMS Password`

Paste the contents of:

`supabase/templates/recovery.html`

Password recovery is available only for an already-activated, active EMS
profile. An unactivated employee must use the latest account-setup invitation
or ask a Super Admin to resend it.

## Redirect configuration

Supabase Dashboard → Authentication → URL Configuration:

**Site URL**

`https://demo-ems-ten.vercel.app`

**Redirect URLs**

`https://demo-ems-ten.vercel.app/set-password`

`https://demo-ems-ten.vercel.app/signup`

For local testing only, you may also allow:

`http://localhost:3000/set-password`

Do not use localhost as the hosted project's Site URL.

## Employee identity lifecycle

### Demo/test workflow

1. Super Admin creates the employee using a deliverable setup email.
2. EMS sends the Invite-user template.
3. The employee creates a password.
4. EMS records account activation.
5. Super Admin assigns the employee's work login email from **System access**.
6. Supabase Auth and the EMS profile change to the new work login together.
7. The employee keeps the same password and signs in with the work login email.
8. Future Forgot Password messages go to the current work/login email.

### Production workflow

Production employee identities remain restricted to the approved company email
domain. Mailbox provisioning itself belongs to the company's mail provider
(Google Workspace, Microsoft 365, or equivalent); EMS manages the application
identity and access lifecycle, not the mailbox infrastructure.

## Security behavior

- Public sign-up is disabled.
- Super Admin controls employee creation and account-setup resends.
- Setup-contact data is stored separately from the current login identity.
- Linked login emails cannot be changed through ordinary profile editing.
- Work/login email changes use the trusted System access workflow.
- Passwords are created by the employee and are never shown to administrators.
- Password recovery returns a generic response and does not reveal whether an
  address belongs to an active EMS account.
