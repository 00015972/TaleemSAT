# 06 — Design System

> The visual language of Taleem SAT. Tokens, components, motion, accessibility.
> Cross-refs: [design/landing.html](../design/landing.html) is the canonical reference for how this feels in practice.

---

## Design philosophy

**Editorial-academic, not generic SaaS.**

Think: a serious test-prep brochure from a top university × the polish of Stripe × the warmth of a hand-bound notebook. Not "AI startup with gradient violet buttons."

### Three principles we don't break
1. **Serif for headlines, sans for UI.** Playfair Display gives gravity. DM Sans gives clarity.
2. **Gold accent is precious, not loud.** Use it sparingly — for the eyebrow lines, important borders, accent words. Never as a primary background.
3. **Warm > cold.** Cream (#f7f5f0) not stark white. The platform should feel inviting, not clinical.

---

## Color tokens

All colors are defined as CSS custom properties on `:root` (light) and `[data-theme="dark"]`. Use these tokens everywhere; never hardcode hex.

### Light theme

| Token | Value | Use |
|---|---|---|
| `--green` | `#1a5c38` | Primary brand — buttons, links, headlines |
| `--green2` | `#236b44` | Secondary green — hover states, gradients |
| `--green-d` | `#0f3f25` | Deep green — pressed states |
| `--green-l` | `#d6ead0` | Light green — surfaces, badges |
| `--green-xl` | `#eaf3e4` | Extra light — hover backgrounds |
| `--gold` | `#b8922a` | Accent — eyebrows, borders, highlights |
| `--gold-d` | `#8a6e1f` | Deep gold — hover on gold elements |
| `--gold-l` | `#f5e9c8` | Light gold — backgrounds, badges |
| `--gold-xl` | `#fbf5e3` | Extra light gold — subtle accents |
| `--bg` | `#f7f5f0` | Page background |
| `--bg-tint` | `#efeadf` | Section backgrounds for differentiation |
| `--surf` | `#ffffff` | Cards, modals |
| `--surf2` | `#f0ede5` | Inset surfaces (passages, code blocks) |
| `--txt` | `#1a1a1a` | Primary text |
| `--txt-soft` | `#2d2d2a` | Secondary text |
| `--muted` | `#6b6962` | Tertiary text, captions |
| `--muted-l` | `#94918a` | Disabled, placeholders |
| `--border` | `#ddd8cc` | Default borders |
| `--border-l` | `#e8e4d7` | Subtle dividers |
| `--ok` | `#1a6b35` | Success, correct answers |
| `--err` | `#b52b2b` | Error, wrong answers |

### Dark theme
Re-mapped on `[data-theme="dark"]` — colors shift to warm-dark tones. Never pure black (#000), always `#13130f` or `#1e1d18` to preserve warmth.

### Color usage rules
- **Primary buttons** use `--green`.
- **Accents and labels** use `--gold-d` (light) / `--gold` (dark).
- **Success states** use `--ok` (not `--green`, since green is brand).
- **Error states** use `--err` consistently.
- **Never use gold as a fill for large areas.** Gold is jewelry. Use it on borders, lines, single words.

---

## Typography

### Font families
- **Display:** `'Playfair Display'`, Georgia, serif — for H1, H2, brand wordmark, big numbers (stats, step numbers)
- **Body:** `'DM Sans'`, system-ui, sans-serif — for everything UI
- **Editorial:** `'Source Serif 4'`, Georgia, serif — for question passages, quotes, anywhere we want "read me carefully" feel
- **Mono:** `'JetBrains Mono'`, ui-monospace — for code, IDs, technical labels

All loaded from Google Fonts with `display=swap`.

### Type scale

| Token | Size | Line height | Use |
|---|---|---|---|
| `text-xs` | 0.75rem (12px) | 1.4 | Eyebrows, labels, captions |
| `text-sm` | 0.875rem (14px) | 1.5 | Body small, secondary text |
| `text-base` | 1rem (16px) | 1.6 | Default body |
| `text-lg` | 1.125rem (18px) | 1.7 | Subheads, lead paragraphs |
| `text-xl` | 1.25rem (20px) | 1.4 | H4 |
| `text-2xl` | 1.5rem (24px) | 1.3 | H3 |
| `text-3xl` | 1.875rem (30px) | 1.2 | H2 |
| `text-4xl` | 2.5rem (40px) | 1.15 | Section H |
| `text-5xl` | 3.5rem (56px) | 1.05 | Hero H1 |
| `text-display` | clamp(2.5rem, 5vw, 4.5rem) | 1.05 | Landing hero |

### Type rules
- **H1, H2, H3:** Playfair Display, weight 600 or 700, slight negative letter-spacing (`-0.02em`).
- **Italic accent words inside headlines:** Playfair italic weight 500, color `--green` (visual signature throughout the site).
- **Body text:** DM Sans 400, weight 500–600 for emphasis.
- **Eyebrow labels:** DM Sans 700, uppercase, letter-spacing 0.22em, paired with gold horizontal line.
- **Numbers:** Tabular figures (`font-variant-numeric: tabular-nums`) anywhere they're compared (scores, points, timer).

---

## Spacing scale

Uses Tailwind's default scale (multiples of 4px).

| Token | Value | Common use |
|---|---|---|
| `0.5` | 2px | Hairline gaps |
| `1` | 4px | Tight icon gaps |
| `2` | 8px | Button padding y |
| `3` | 12px | Card internal padding |
| `4` | 16px | Default padding |
| `5` | 20px | Section content padding |
| `6` | 24px | Card padding |
| `8` | 32px | Wrap padding |
| `12` | 48px | Section spacing (mobile) |
| `16` | 64px | Section spacing (desktop) |
| `24` | 96px | Major section gaps |

**Rule:** Don't invent custom paddings. Use the scale.

---

## Radius scale

| Token | Value | Use |
|---|---|---|
| `--rad-s` | 6px | Buttons, small inputs |
| `--rad` | 10px | Cards, inputs |
| `--rad-l` | 18px | Modals, hero preview cards, certificates |

Circles for avatars, status dots, badges.

---

## Shadow scale

| Token | Value | Use |
|---|---|---|
| `--shad-s` | `0 1px 3px rgba(0,0,0,.06)` | Subtle elevation on inputs |
| `--shad` | `0 4px 20px rgba(0,0,0,.07)` | Default card hover |
| `--shad-l` | `0 24px 60px -20px rgba(26,92,56,.22)` | Hero card, modals (greenish tint!) |
| `--shad-gold` | `0 20px 50px -22px rgba(184,146,42,.35)` | Featured card (pricing Pro tier) |

Shadows are tinted with brand colors, not neutral. Adds warmth.

---

## Iconography

- **Library:** Lucide React (`lucide-react`) — clean, consistent, customizable stroke.
- **Default size:** 16px in UI, 20–24px in feature highlights.
- **Stroke:** 2px (default Lucide).
- **Color:** `currentColor` so they inherit from parent.

**No emoji icons** in production UI. (Emojis are fine in temporary mockups or admin internal pages.)

---

## Components

These are the building blocks. Implementation lives in `app/components/ui/`.

### Button

Variants:
- `primary` — green bg, white text. The main CTA.
- `outline` — green border, green text on transparent.
- `ghost` — text only, hover underline.
- `gold` — gold bg, used sparingly (final CTAs, featured tier).
- `danger` — red, for destructive actions.

Sizes: `sm` (32px height), `md` (40px), `lg` (48px).

States: default, hover, active, disabled, loading (with spinner).

### Input
- 40px height
- 1.5px border
- `:focus-visible` ring in `--green`
- Error state: red border, red helper text below
- `<label>` always above, never placeholder-as-label

### Card
- White surface
- 1px border in `--border`
- Radius `--rad`
- Default padding 24px
- Hover: slight lift (`translateY(-2px)`) + `--shad`

### Eyebrow label
The signature pattern. Tiny gold caps with horizontal line. Used at the top of every section.

```html
<div class="eyebrow">Section name</div>
```

CSS already defined in `landing.html` — port to a Tailwind utility class `.eyebrow`.

### Question option (`pc-opt`)
The clickable answer option in practice/QOD. Has states:
- default
- hover (green border)
- selected (green border + green-l bg)
- correct (after submit) — green-success
- wrong (after submit) — red-error
- eliminated (struck through, dimmed)

### Tier card
Used in pricing. Three variants: free, pro (featured), elite. Featured has gold border + "Most chosen" tag.

### Certificate
Editorial PDF + on-screen mockup. Gold seal, italic name, signature line. See `landing.html` for the rendered mockup; the actual PDF uses `@react-pdf/renderer` with similar styling.

### Badge / Pill
- Subject pill (English green, Math gold)
- Status badge (Easy/Medium/Hard)
- Tier badge (Free/Pro/Elite)

### Modal / Dialog
- Backdrop: `rgba(0,0,0,.5)` + blur
- Card: white, `--rad-l`, max-w 600px, max-h 88vh, scroll inside
- Close button top-right
- Use shadcn/ui `Dialog` primitive

### Empty state
- Centered illustration (SVG, simple line art)
- Headline + sub
- Primary action button

---

## Motion

### Principles
- **Choreographed, not decorative.** Motion has a purpose: indicate progress, reveal information, draw attention to the right place.
- **Fast for UI, slow for delight.** Microinteractions ≤ 200ms. Page entrance animations ~600–900ms.
- **Easing matters.** Use `cubic-bezier(.22,.61,.36,1)` (our `--ease` token) — slight overshoot feel, not flat linear.
- **Respect `prefers-reduced-motion`.** Disable scroll-triggered reveals + reduce duration.

### Key motion patterns

| Pattern | Where | Duration | Easing |
|---|---|---|---|
| Page-load stagger | Hero on first paint | 600–900ms, 100ms stagger | `--ease` |
| Section reveal on scroll | Cards, steps | 700ms once | `--ease` |
| Button hover lift | All primary buttons | 200ms | `--ease` |
| Number count-up | Stats bar | 1400ms | `easeOutCubic` |
| Bar fill | Analytics bars | 1500ms | `--ease` |
| Card flip on success | (reserved for celebration moments) | 600ms | `--ease` |
| Question reveal | After submitting | 250ms | `--ease` |

### Library
- **Plain CSS** for simple things (hover, transitions).
- **Motion library** (Framer Motion successor) for orchestrated sequences — only where really needed.
- **No jQuery, no Anime.js** — overkill.

---

## Responsive breakpoints

| Name | Min width | Use |
|---|---|---|
| (default) | 0 | Mobile |
| `sm` | 640px | Large mobile / small tablet |
| `md` | 768px | Tablet |
| `lg` | 1024px | Small laptop |
| `xl` | 1280px | Desktop |

**Design mobile-first.** Default styles are mobile; add larger styles with `md:` `lg:` prefixes.

### Page max-width
- Content wrap: `max-w-[1200px]` with `px-8` (desktop) / `px-5` (mobile).
- Article-style content (privacy, terms): `max-w-[720px]` for readability.

---

## Accessibility (WCAG AA target)

### Color contrast
- All text passes WCAG AA (4.5:1 for normal, 3:1 for large).
- Verified in light + dark mode.
- Never use color alone to convey meaning (e.g. wrong answers have an icon, not just red).

### Keyboard
- Every interactive element is keyboard-reachable.
- Visible focus indicator (a 2px green ring) on `:focus-visible`.
- Logical tab order (don't override with `tabindex` unless necessary).
- Modals trap focus and restore on close.

### Screen readers
- Semantic HTML first (`<button>`, `<nav>`, `<main>`, `<article>`).
- `aria-label` for icon-only buttons.
- `aria-live="polite"` regions for dynamic updates (correct answer reveal, points earned).
- `<label>` properly associated with inputs.

### Motion
- Honor `prefers-reduced-motion: reduce` — kill non-essential transitions and reveals.

### Forms
- Errors announced via `aria-invalid` + `aria-describedby`.
- Required fields marked.
- Submit buttons disabled while loading, with `aria-busy="true"`.

### Internationalization (future)
- Wrap copy in i18n strings from day one even though we're English-only at launch.
- Use logical CSS properties (`padding-inline-start` not `padding-left`).

---

## Dark mode

Toggle in header. Stored in `localStorage` (`taleem_theme`). Respects `prefers-color-scheme` on first visit.

### Dark mode rules
- Keep the warmth — `#13130f` base, not pure black.
- Increase contrast on text slightly for legibility.
- Soften brand greens (we go *lighter* in dark mode, not darker — `#3a8c5e` instead of `#1a5c38`).
- Gold goes brighter (`#d4ad3f`).
- Shadows lose color tint and become pure dark.

---

## Imagery & illustration

- **Photos:** the tutor portrait is the primary photographic element. Use sparingly.
- **Illustrations:** custom SVG line drawings in our brand colors for empty states and feature explanations. No stock illustration packs.
- **Icons:** Lucide only.
- **No 3D, no gradients-as-graphics, no abstract blobs.** Stay editorial.

---

## Component checklist (build order)

In the order we'll need them:

- [ ] Button (primary, outline, ghost, gold, danger × 3 sizes)
- [ ] Input (text, email, password, number, textarea)
- [ ] Select / Combobox
- [ ] Checkbox / Radio
- [ ] Card
- [ ] Modal / Dialog
- [ ] Toast (success / error / info)
- [ ] Badge / Pill
- [ ] Eyebrow label
- [ ] Section header (eyebrow + h2 + sub)
- [ ] Tier card
- [ ] Question option
- [ ] Question card (header + body + opts)
- [ ] Stat (number + label)
- [ ] Progress bar
- [ ] Avatar
- [ ] Tooltip
- [ ] Tabs
- [ ] Pagination
- [ ] Empty state
- [ ] Loading skeleton (per component)
- [ ] Header (sticky, with theme toggle)
- [ ] Footer

---

## Living style guide

Once the components exist, we maintain `/styleguide` (admin-only or hidden) that renders every variant. Helps catch drift.

---

**See next:** [07-ux-flows.md](07-ux-flows.md) for how these pieces combine into user journeys.
