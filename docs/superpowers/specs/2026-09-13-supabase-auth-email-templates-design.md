# Taleem SAT Supabase Auth Email Templates Design

**Date:** 13 September 2026  
**Status:** Approved for implementation

## Objective

Replace Supabase's minimally styled authentication emails with a complete Taleem SAT email system covering all 13 currently supported authentication and security-notification templates. Every template must be ready to paste into the hosted Supabase Dashboard, visually consistent with the product, and robust across common desktop and mobile email clients.

## Scope

The deliverable covers six authentication templates:

1. Confirm signup
2. Invite user
3. Magic link or OTP
4. Change email address
5. Reset password
6. Reauthentication

It also covers seven security notification templates:

1. Password changed
2. Email address changed
3. Phone number changed
4. Sign-in method linked
5. Sign-in method removed
6. Verification method added
7. Verification method removed

Each template receives a self-contained HTML file and a recommended email subject. A companion README maps every file to its exact Supabase Dashboard location and explains how to install the templates manually.

## Approved Visual Direction

The approved direction is **Editorial Letter with an emerald header**. It adapts the Taleem SAT product's editorial-academic visual system to the stricter requirements of email clients.

The email uses:

- a warm cream outer background;
- a centered white message card no wider than 600 pixels;
- a full-width deep emerald header block;
- an image-free Taleem SAT “T” monogram presented in a compact white frame;
- a white Taleem SAT wordmark and muted-green “Practice with purpose” tagline;
- a thin antique-gold divider beneath the header;
- an editorial eyebrow, strong dark-green heading, restrained body copy, and emerald CTA;
- a light cream footer with Taleem SAT identification and a Help Center link.

The monogram is constructed from nested presentation tables, background colors, borders, and live text. It does not make a remote image request, so the mark and adjacent wordmark remain visible when an email client blocks images. Website and Help Center links use the public `https://taleemsat.com` domain directly.

## Template Architecture and Compatibility

Each HTML file is deliberately self-contained because the Supabase Dashboard stores template bodies independently and does not provide reusable partials. Shared visual rules are duplicated across the files so each can be pasted without a build or preprocessing step.

Templates use nested presentation tables, inline CSS, explicit widths, conservative borders and backgrounds, and a web-safe font stack. The design does not depend on JavaScript, external stylesheets, SVG, CSS variables, flexbox, grid, animation, or web fonts. Buttons use a table-based, large-click-target construction. Important information remains readable when images are disabled.

Every linked authentication action uses Supabase's generated `{{ .ConfirmationURL }}` rather than constructing a new verification endpoint. This preserves the application's current `emailRedirectTo` and `/auth/callback` flow. Reauthentication presents `{{ .Token }}` as an eight-digit code. Template-specific variables are used only where Supabase documents them as available.

## Content System

Authentication emails use calm, encouraging language connected to focused SAT practice. Their eyebrow, heading, explanatory copy, CTA, and safety note vary by action while the overall structure remains stable.

Security notifications use a more direct tone. They clearly name the change, show relevant old/new values or provider/factor details when Supabase exposes those variables, and direct an unrecognized-change recipient to the Taleem SAT Help Center. Security notifications do not invent unsupported recovery URLs or claim that a change can be reversed automatically.

The template set remains English-only, matching the current application and existing Supabase subjects. Copy avoids promotional content so transactional messages remain focused and deliverable.

## File Layout

Implementation creates:

```text
supabase/templates/
├── README.md
├── confirmation.html
├── invite.html
├── magic-link.html
├── email-change.html
├── recovery.html
├── reauthentication.html
├── password-changed-notification.html
├── email-changed-notification.html
├── phone-changed-notification.html
├── identity-linked-notification.html
├── identity-unlinked-notification.html
├── mfa-factor-enrolled-notification.html
└── mfa-factor-unenrolled-notification.html
```

The README includes the subject for each file, the Supabase Dashboard label, the exact navigation path, logo requirements, test instructions, and cautions about link tracking and automatic link prefetching.

## Installation Boundary

The repository currently has hosted Supabase application credentials but no local `supabase/config.toml`, Supabase CLI installation, or Supabase Management API access token. Implementation therefore adds the complete source-controlled template set first.

After the files are verified, the hosted Dashboard may be updated directly only if the user's existing authenticated Supabase project is accessible. No application service-role key will be repurposed as a Management API token. Any templates that cannot safely be installed directly remain available for manual paste with exact placement instructions.

Security notification templates must be enabled at project level for Supabase to send them. The README identifies the enablement control without assuming that every notification should be enabled silently.

## Error and Edge Cases

- Long email addresses, phone numbers, provider names, and factor names wrap without widening the card.
- The image-free monogram and visible Taleem SAT wordmark remain available without remote-image permission.
- A blocked background color does not hide white text because the header includes a dark fallback background declaration and the message body contains the action context.
- Action emails include a visible raw-link fallback for recipients whose client does not render the button correctly.
- Security templates avoid unsupported action links; the Help Center is the stable response path.
- The reauthentication token remains selectable, high contrast, and understandable without decorative styling.
- Mobile layouts use fluid container widths and safe horizontal padding.

## Verification

Implementation is complete when:

- all 13 HTML files exist and use only variables documented for their template type;
- every linked authentication email contains `{{ .ConfirmationURL }}` and a plain fallback link;
- reauthentication contains `{{ .Token }}`;
- notification templates contain their documented contextual variables where applicable;
- every file contains the approved emerald header and gold divider;
- every file contains the image-free monogram and visible fallback branding;
- the README maps all 13 files and subjects to their Dashboard locations;
- HTML is checked for balanced tags, unresolved implementation placeholders, and accidental use of application-only CSS;
- representative action, code, and security-notification templates are rendered at desktop and mobile widths for visual inspection;
- direct Dashboard installation is attempted only through an authenticated, clearly identified project and each saved template is visibly verified.

## Out of Scope

This work does not replace Supabase email delivery with a custom Send Email Hook, configure a third-party SMTP provider, create React Email components, change authentication redirects, add a new logo asset, alter application authentication logic, or add multilingual email content.
