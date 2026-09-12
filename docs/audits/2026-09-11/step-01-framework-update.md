# Step 01 — framework security update

Completed locally on 11 September 2026. This implements the framework update in B01 of the [launch audit](../../launch-audit-2026-09-11.md). It does not represent a deployment or completion of the other launch gates.

## Change

- Pinned `next` from `16.2.6` to `16.3.4`.
- Pinned `eslint-config-next` from `16.2.6` to `16.3.4`.
- Regenerated the pnpm lockfile through a targeted update of those two packages. Related framework/compiler/image dependencies changed, including Sharp `0.34.5` → `0.35.4`.
- No application-source or configuration changes were required for compatibility.

The registry identified 16.3.4 as the current stable release. It follows the security release 16.3.3 and restores AVIF image optimization using the updated dependency chain. [Official release notes](https://github.com/vercel/next.js/releases/tag/v16.3.4).

## Validation

| Check | Result |
|---|---|
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| Existing readiness, date, and rich-text tests | 15 passed, 0 failed |
| `pnpm build` | Passed with Next.js 16.3.4; existing route inventory preserved |
| Local production HTTP checks | 10 passed: four auth pages, three protected-page redirects, two anonymous API denials, and JPEG optimization |
| Dependency audit | Completed; exits nonzero because outstanding advisories remain |

HTTP checks confirm server responses and native image processing. They do not replace full authenticated browser journeys, email recovery tests, deployed Linux checks, or RLS verification. No student answers, account changes, test emails, or deployments were performed for this update. The temporary production server was stopped after checks.

## Security audit comparison

| Severity | Before | After |
|---|---:|---:|
| Critical | 2 | **0** |
| High | 32 | 25 |
| Moderate | 26 | 20 |
| Low | 7 | 7 |
| Total advisory records | 67 | **52** |

No remaining advisory record targets `next` or `sharp`. Some remaining records still have a dependency path through Next's build tooling; this is not a claim that the whole dependency tree is vulnerability-free. Counts are registry records and can include the same advisory for different affected version ranges.

All remaining records, installed versions, paths, and published fix ranges are preserved in [the updated advisory export](dependency-advisories-after-step-01.csv). [Machine-readable check results](step-01-results.json) preserve the comparison and HTTP outcomes. The original audit artifacts remain historical baseline evidence.

## Remaining advisory triage

This groups every remaining record by dependency and reachable use. It is an applicability review, not a penetration test or acceptance of permanent risk. Publish-time dependency cleanup must resolve or explicitly reassess these records.

| Dependency | Records | Observed exposure and follow-up |
|---|---:|---|
| `pnpm` 11.2.2 | 17: 11 high, 6 moderate | Unnecessary production dependency; no application import. Advisories concern package-manager execution against malicious project/config/package inputs. The command used for this update was the external pnpm 11.24.0, not this locked copy. Remove the app dependency and pin the supported package manager in the planned dependency-cleanup step. |
| `js-yaml` 4.1.1 | 4: 3 high, 1 moderate | Reached through ESLint configuration tooling, not the student HTML importer. Update the lint dependency chain to a compatible patched version; the highest published fix floor in these records is 4.3.2. Do not pass untrusted YAML to this tooling. |
| `brace-expansion` 1.1.14 / 5.0.6 | 6 high | ESLint/minimatch tool paths; no direct student-request input path found. Update within the respective compatible branches to at least 1.1.18 / 5.0.9, or a supported parent dependency that resolves them. |
| `postcss` 8.5.15 | 2: 1 high, 1 moderate | Remaining paths are the CSS build chain via direct PostCSS, Tailwind, and Autoprefixer. Student content is not processed as arbitrary build CSS. Update the compatible CSS tooling dependency chain; the listed high finding is fixed from 8.5.18. |
| `nanoid` 3.3.12 | 2 high | Remaining paths are under the CSS build pipeline. No application-supplied generator size was found. Upgrade the compatible transitive branch to at least 3.3.18. |
| `browserslist` 4.28.2 | 2 high | Build/compiler paths via Babel, Next/styled-jsx, Autoprefixer, and lint. Query/statistics inputs are project-controlled, not student requests. Update to at least 4.28.7 through supported parents or a scoped compatible refresh. |
| `esbuild` 0.18.20 / 0.28.0 | 2: 1 moderate, 1 low | Database CLI and local build/test tooling. Review/update the parent tool versions; do not expose development servers publicly. |
| `dompurify` 3.4.5 | 10: 6 moderate, 4 low | Browser dependency of PostHog. Its practical exposure depends on enabled PostHog features and input flows; do not classify it as build-only. Update or remove the unused analytics integration in its planned step. |
| `protobufjs` 7.6.1 | 2 moderate | PostHog dependency; review the configured features and update its parent package. |
| `@opentelemetry/core` 2.2.0 / 2.7.1 | 1 moderate | PostHog dependency; update the parent and verify the actual enabled telemetry path. |
| `fflate` 0.4.8 | 1 moderate | PostHog dependency; update the parent and verify input handling for enabled features. |
| `@babel/core` 7.29.0 | 1 low | Framework/lint compilation tooling; review compatible Babel parent updates. |
| `postcss-selector-parser` 6.1.2 | 1 low | Tailwind CSS compilation path; refresh the supported tooling dependency chain. |
| `baseline-browser-mapping` 2.10.32 | 1 moderate | Browser-target data under framework/CSS/lint tooling; refresh compatible browser-target dependencies. |

The external package advisories and fix ranges in this table come from the successful registry audit; each corresponding advisory URL is in the CSV. No forced overrides or unrelated major dependency upgrades were introduced in this step.

The next requested list item is B02: show mock tests as “In development” to students and enforce the restriction in both API handlers.
