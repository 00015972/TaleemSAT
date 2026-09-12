# Taleem SAT Public Beta Landing Design

**Date:** 12 September 2026  
**Status:** Approved for implementation  
**Audit item:** B10 — Ship a truthful landing page and a supportable release

## Objective

Replace the Phase 0 status page with an eye-catching, truthful public entrance for Taleem SAT's free beta. The new landing page must preserve the strongest parts of `design/landing.html`, align with the newer product UI, keep the existing tutor photograph, use the real logo, remove pricing, and advertise only working product capabilities.

The same implementation adds public Help, Privacy, and Terms pages and connects them through a shared footer. It does not claim to complete B10's separate production operations requirements such as hosted authentication verification, backup restoration exercises, rollback validation, or operator/legal review.

## Approved Visual Direction

The selected direction is **Score Atelier**: warm editorial polish with tactile SAT-paper motifs and lively progress moments.

The visual language retains Taleem SAT's cream, emerald, and antique-gold identity while making it more dimensional and contemporary. The page uses answer bubbles, ruled paper, margin marks, progress lines, and score annotations as contextual decoration. It avoids generic abstract gradients, stock illustration packs, and unrelated decorative imagery.

The real `public/logo.jpg` artwork appears as a compact brand mark in the shared header and footer. The existing `design/bahromjon.jpg` portrait remains in place and is also exposed to the Next.js public page without deleting or replacing the source image.

## Audience and Message

The primary audience is a student or parent evaluating Taleem SAT for the first time. A visitor should understand within one screen that:

- Taleem SAT is a Digital SAT practice platform.
- The beta is free and requires no payment.
- Students can practice by SAT category and track progress.
- The platform is built around an identifiable instructor.
- Sign-up, sign-in, password recovery, and support routes are available.

The page must not describe billing, certificates, full mock SATs, adaptive study plans, or AI coaching as available. It includes one compact beta-scope notice stating that billing and full mock tests are not currently offered. It must not turn unavailable features into a prominent marketing promise.

## Public Information Architecture

### Shared header

The public route group uses a shared responsive header with:

- logo and Taleem SAT wordmark linked to `/`;
- anchor links for Practice, How it works, and Instructor;
- a Help link to `/help`;
- theme toggle;
- Sign in link to `/login`;
- primary Start free link to `/signup`.

On narrow screens, secondary section links may collapse while the brand, theme control, and primary account actions remain accessible. Focus visibility and logical tab order are required.

### Landing page

The landing page sections appear in this order:

1. **Hero:** free-beta eyebrow, outcome-focused headline, concise live-scope copy, signup and sign-in actions, and animated answer-sheet artwork.
2. **Proof strip:** eight SAT focus areas, free beta access, and progress tracking. Claims about teaching credentials remain separate from product metrics.
3. **Practice showcase:** a representative question card and answer bubbles illustrating the live practice workflow without pretending to submit data.
4. **Available today:** category practice, accuracy analytics, daily missions, streaks, and XP. Each block includes a contextual CSS/SVG illustration rather than a generic icon-only tile.
5. **Instructor:** the existing Bahromjon Jo'raqulov portrait, existing name and credential claims from the approved reference, and a calm editorial quotation treatment.
6. **How it works:** create an account, choose a category, and track improvement.
7. **Beta scope:** a small, direct statement that the current release is free and that purchases and full mock tests are not offered.
8. **Final call to action:** Start practicing free, with a secondary sign-in path.

### Shared footer

The shared footer appears on all public pages and includes:

- Taleem SAT brand and short description;
- product links to the landing anchors and signup;
- Help, Privacy, and Terms links;
- support email `mirsoduq@gmail.com`;
- Telegram support link `https://t.me/mirik_akramov`;
- a small credit: “Developed by Mirsodiq Akramov,” with the name linked to `https://t.me/mirik_akramov`.

The developer credit is deliberately visually quiet and must not compete with the product brand or primary calls to action.

## Supporting Pages

### Help

`/help` is a practical support surface, not a generic contact placeholder. It contains:

- direct email support through `mirsoduq@gmail.com`;
- Telegram support through `@mirik_akramov`;
- links to sign in, sign up, and `/forgot-password`;
- short guidance for reporting a question problem, including the question identifier or category and a description of the issue;
- expected support language that does not promise a response time the operator has not approved;
- links to Privacy and Terms.

### Privacy

`/privacy` is clear product-specific information rather than copied legal boilerplate. It describes:

- account data such as name and email;
- optional profile data such as target score and exam date;
- practice activity such as answers, accuracy, timing, streaks, and XP;
- authentication/session data and essential technical logs;
- the purposes of account operation, progress reporting, security, and product improvement;
- service providers used to run the application where confirmed by the repository;
- retention in practical terms without inventing a fixed period;
- account-data access, correction, and deletion requests sent to `mirsoduq@gmail.com`;
- the 13+ audience requirement;
- policy changes and the policy's effective date.

The page must not make absolute security guarantees or claim regulatory compliance that has not been reviewed.

### Terms

`/terms` describes:

- free-beta access and the absence of a current paid offering;
- minimum age of 13;
- account responsibility and acceptable use;
- educational content without a guaranteed SAT result;
- ownership of the platform and authored content;
- prohibition on scraping, redistribution, abuse, and interference;
- beta availability, changes, and possible interruptions;
- account restriction or termination for abuse;
- contact at `mirsoduq@gmail.com`;
- the terms' effective date.

The page does not invent a governing-law venue, refund policy, or paid-subscription obligation. Operator and legal review remains a release task before inviting students at scale.

## Components and Boundaries

The implementation should keep each unit focused:

- **Public shell:** shared header and footer, public navigation, theme control, support and legal links.
- **Landing content:** static semantic section structure and truthful marketing copy.
- **Landing artwork:** decorative answer sheet, progress, category, and tutor-adjacent compositions isolated from core content.
- **Reveal behavior:** a small client component responsible only for intersection-based entrance state. Core content remains visible without JavaScript.
- **Policy article layout:** a reusable readable article wrapper for Help, Privacy, and Terms.

The landing page is statically rendered and does not initialize a Supabase client or query live taxonomy counts. Product artwork uses CSS and inline semantic-free SVG where practical; it does not require a new runtime animation dependency.

## Motion and Interaction

Motion should make progress feel tangible:

- stagger the hero copy and artwork on first paint;
- animate answer bubbles and a progress rule in the hero illustration;
- reveal feature blocks once as they enter the viewport;
- use restrained card lift, button sheen, and line movement on hover;
- keep the logo and instructor portrait stable enough to preserve trust.

All nonessential motion is disabled or reduced under `prefers-reduced-motion: reduce`. No animation may block reading, navigation, or a primary action.

## Responsive and Accessibility Requirements

- Mobile-first layout with deliberate states at approximately 640, 768, and 1024 pixels.
- No horizontal overflow at a 320-pixel viewport.
- Semantic headings, landmarks, lists, and links.
- Decorative artwork hidden from assistive technology.
- Descriptive alternate text for the tutor portrait; the redundant logo may use an empty alternate string when adjacent brand text supplies the accessible name.
- WCAG AA text contrast in light and dark modes.
- Clearly visible keyboard focus styles.
- External Telegram links use safe new-tab attributes when opened in a new tab.
- Touch targets remain comfortably usable on mobile.

## Failure and Fallback Behavior

Because the public pages are static, database or Supabase latency must not affect their render. If images fail, meaningful text and layout remain usable. If JavaScript is unavailable, all page content and navigation remain visible; only entrance motion is omitted. Unknown routes use the application's normal not-found behavior.

The support surface provides both email and Telegram so a problem with one channel does not remove every contact route. Password problems point to the existing recovery flow rather than collecting credentials or reset details through support.

## Verification

Implementation is complete when the following pass:

- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm build`;
- `/`, `/help`, `/privacy`, and `/terms` render successfully in the production build;
- `/` contains no Supabase client creation or live database counts;
- signup, sign-in, forgot-password, support, Privacy, Terms, and Telegram links resolve to the intended destinations;
- pricing and purchase calls to action are absent;
- certificates, full mock SATs, adaptive plans, and AI coaching are not presented as available;
- the real logo and Bahromjon portrait render without removing the original source image;
- desktop and mobile browser checks show no clipping or horizontal overflow;
- keyboard navigation, focus treatment, light/dark theme, and reduced-motion behavior are manually checked;
- a basic performance check confirms the page no longer waits on the two former sequential Supabase count requests.

## Audit Closure Boundary

This work closes the implementation portion of B10's public-page requirement. B10 remains only partially closed until the operator reviews the public policy text and the deployment owner separately verifies production hosting/auth settings, help-channel ownership, backup restoration, and rollback procedures.
