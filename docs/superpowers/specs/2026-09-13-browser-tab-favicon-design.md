# Browser Tab Favicon Design

## Goal

Show the existing Taleem SAT logo in browser tabs on every page.

## Design

Use the existing square asset at `public/logo.jpg` as the global favicon. Add an `icons` entry to the root Next.js metadata in `app/layout.tsx`, pointing the standard icon and shortcut icon relationships to `/logo.jpg`. Keeping the configuration in the root layout applies it consistently across public, authentication, app, and admin routes without duplicating the image.

## Behavior and Failure Handling

Next.js will emit the favicon link metadata in the document head. If the image cannot be loaded, the browser falls back to its default tab icon; no application flow is affected.

## Verification

- Run the project's static checks.
- Confirm the generated metadata configuration targets `/logo.jpg`.
- Open the app in a browser and verify the Taleem SAT logo appears in the tab. Browser favicon caches may require a hard refresh.

## Scope

This change does not alter page-title text, visible page branding, or the logo asset itself.
