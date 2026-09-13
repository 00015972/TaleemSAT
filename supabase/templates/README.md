# Taleem SAT Supabase Email Templates

These are ready-to-paste HTML templates for all 13 hosted Supabase Auth email templates available as of 13 September 2026.

## Before installing

- Deploy the application and confirm that `{{ .SiteURL }}/logo.jpg` resolves publicly. In this repository, it maps to `public/logo.jpg`.
- In Supabase, set **Authentication → URL Configuration → Site URL** to the production Taleem SAT URL.
- Keep link tracking disabled in the SMTP/email provider. Rewritten authentication links may not work correctly.
- Send a test email after saving each action template. Some security scanners prefetch one-time links; Supabase documents OTP or an intermediate confirmation page as alternatives if this affects your users.

The repository's local `NEXT_PUBLIC_SITE_URL` is currently `http://localhost:3000`, which is correct for local development but cannot serve an image to real email recipients. The hosted Supabase project's Site URL must be the public HTTPS production domain before these templates are used. If the production app will not host the logo, upload `public/logo.jpg` to a public HTTPS location and replace every `{{ .SiteURL }}/logo.jpg` occurrence with that fixed image URL.

## Where to paste each template

Open the [Supabase Dashboard](https://supabase.com/dashboard), select the Taleem SAT project, then go to **Authentication → Email Templates**.

### Authentication emails

| Dashboard template | Subject to paste | HTML file |
| --- | --- | --- |
| Confirm signup | `Confirm your Taleem SAT email` | [`confirmation.html`](./confirmation.html) |
| Invite user | `You're invited to Taleem SAT` | [`invite.html`](./invite.html) |
| Magic link | `Your secure Taleem SAT sign-in link` | [`magic-link.html`](./magic-link.html) |
| Change email address | `Confirm your new Taleem SAT email` | [`email-change.html`](./email-change.html) |
| Reset password | `Reset your Taleem SAT password` | [`recovery.html`](./recovery.html) |
| Reauthentication | `{{ .Token }} is your Taleem SAT verification code` | [`reauthentication.html`](./reauthentication.html) |

For each row, open the matching Dashboard template, replace its **Subject** and **Message body**, then save.

### Security notifications

On the same page, open **Security notifications**. Enable a notification if you want Supabase to send it, then paste the matching subject and HTML.

| Dashboard template | Subject to paste | HTML file |
| --- | --- | --- |
| Password changed | `Your Taleem SAT password was changed` | [`password-changed-notification.html`](./password-changed-notification.html) |
| Email address changed | `Your Taleem SAT email address was changed` | [`email-changed-notification.html`](./email-changed-notification.html) |
| Phone number changed | `Your Taleem SAT phone number was changed` | [`phone-changed-notification.html`](./phone-changed-notification.html) |
| Sign-in method linked | `A sign-in method was linked to your Taleem SAT account` | [`identity-linked-notification.html`](./identity-linked-notification.html) |
| Sign-in method removed | `A sign-in method was removed from your Taleem SAT account` | [`identity-unlinked-notification.html`](./identity-unlinked-notification.html) |
| Verification method added | `A verification method was added to your Taleem SAT account` | [`mfa-factor-enrolled-notification.html`](./mfa-factor-enrolled-notification.html) |
| Verification method removed | `A verification method was removed from your Taleem SAT account` | [`mfa-factor-unenrolled-notification.html`](./mfa-factor-unenrolled-notification.html) |

## Supabase variables used

- `{{ .ConfirmationURL }}` — generated one-time action URL
- `{{ .Token }}` — reauthentication verification code
- `{{ .SiteURL }}` — configured production application URL
- `{{ .Email }}` — current user email address
- `{{ .NewEmail }}` and `{{ .OldEmail }}` — email-change context
- `{{ .Phone }}` and `{{ .OldPhone }}` — phone-change context
- `{{ .Provider }}` — linked or removed sign-in provider
- `{{ .FactorType }}` — added or removed verification method

Do not replace the `{{ ... }}` expressions with literal values. Supabase fills them when it sends each message.

## Testing checklist

1. Send confirm-signup, magic-link, password-reset, and invite emails to Gmail and Outlook test inboxes.
2. Verify the logo loads and the visible Taleem SAT wordmark remains readable with images disabled.
3. Click both the button and the fallback URL in each action email.
4. Confirm the callback reaches the intended Taleem SAT page and that one-time links cannot be reused.
5. View messages on a narrow mobile screen and in an email client's dark mode.
6. Trigger each enabled security notification and verify its old/new value, provider, or verification-method text.

Supabase references: [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [Customizing Email Templates](https://supabase.com/docs/guides/local-development/customizing-email-templates).
