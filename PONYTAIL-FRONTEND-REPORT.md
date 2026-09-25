# Ponytail Frontend Refactor Report

Scope: `apps/web/app`, `apps/web/components`. Zero functional changes — dead-code and unused-import removal only.

## Files touched

| File | Reason |
|---|---|
| `app/dashboard/_components/DashboardSidebar.tsx` | Removed unused `React` default import, unused lucide icons (`Palette`, `Zap`, `Bell`, `Users`, `ChevronDown`, `Check`, `Menu`, `User`, `LogOut`, `Moon`, `Sun`, `CreditCard`), unused `AnimatePresence` import, and dead code: `isDarkMode` state + `useEffect` that set it, `toggleTheme()` and `handleLogout()` (both defined but never called or wired to any element), and the `useDashboard()` destructure of `tenants/currentTenant/selectedTenantId/handleTenantChange` (none referenced anywhere in the file) |
| `app/dashboard/_components/TemplateWorkspace.tsx` | Removed unused `Link` (next/link) and `QRCodeSVG` (qrcode.react) imports |
| `app/dashboard/_components/DashboardHeaderBrand.tsx` | Removed unused `React` default import (JSX uses automatic runtime, no `React.*` calls) |
| `app/dashboard/_components/MapSearchBox.tsx` | Same — unused `React` default import |
| `app/dashboard/_components/PushCampaignsView.tsx` | Same — unused `React` default import |
| `app/dashboard/_components/SettingsView.tsx` | Same — unused `React` default import |
| `app/dashboard/developers/page.tsx` | Same — unused `React` default import |
| `app/dashboard/page.tsx` | Same — unused `React` default import |
| `app/dashboard/settings/page.tsx` | Same — unused `React` default import |
| `app/enroll/EnrollFlow.tsx` | Same — unused `React` default import |
| `app/enroll/page.tsx` | Same — unused `React` default import |
| `app/login/page.tsx` | Same — unused `React` default import |
| `app/page.tsx` | Same — unused `React` default import |
| `components/ScanHistoryTable.tsx` | Same — unused `React` default import |

All named-import hooks (`useState`, `useEffect`, etc.) were kept; only the unused default `React` binding was dropped in each case, verified individually by grepping for `React.` usage before removing.

## Lines removed vs added

`git diff --stat`: 14 files changed, 12 insertions(+), 45 deletions(-). Net ~33 lines removed, concentrated in `DashboardSidebar.tsx` (dead theme-toggle/logout code + unused icon imports).

## Patterns/abstractions removed

- Dead `toggleTheme()` / `handleLogout()` functions in `DashboardSidebar.tsx` — orphaned since a prior refactor moved theme toggling and logout elsewhere; nothing in the current render tree called them.
- Unused context destructure in the same file (reading 4 values from `useDashboard()` that were never used) — no abstraction change, just removed the dead read.
- No one-off abstractions collapsed and no boilerplate cut beyond import/dead-code trimming — the rest of the codebase (`DashboardContext.tsx`, view components, program-scoped pages) is already fairly lean; further "shortening" risked behavior drift and was skipped (see below).

## Flagged but deliberately skipped

- **`app/dashboard/live-activity/view.tsx`, `push-campaigns/view.tsx`, `template-designer/view.tsx`**: initially misidentified as orphaned (their sibling `page.tsx` files under those same legacy routes use `LegacyProgramRedirect` instead). They are in fact still imported by the *program-scoped* pages (`app/dashboard/programs/[id]/activity|campaigns|design/page.tsx`) via relative paths (`../../../live-activity/view` etc.) that a plain-text `Grep` for the literal path didn't catch on the first pass. Confirmed live via `tsc --noEmit`, which failed with `Cannot find module` after deletion — restored immediately with `git checkout --`. Left untouched. **This is the one real risk item from this pass: verify with `git status`/`git diff` that these three files show no changes before merging.**
- Deep restructuring of `DashboardContext.tsx` (400+ lines, several near-duplicate `designData` reset blocks) — left as-is. Collapsing the repeated default-`designData` object into a shared constant is a legitimate follow-up but touches state initialization across multiple effects/handlers; skipped to avoid any risk of altering reset timing or object identity behavior.
- Did not touch component logic, JSX structure, prop shapes, or `apiClient` call sites anywhere — out of scope per task instructions and higher risk than the mechanical import/dead-code cleanup done here.
- No `npm run lint` — `apps/web` has no `lint` script defined (`npm error Missing script: "lint"`); root `npm run lint` runs `turbo run lint` across all workspaces including `apps/api`, which was explicitly out of scope, so it was not run to avoid conflating results.

## Verification

- `npx tsc --noEmit` in `apps/web`: clean before and after (0 errors both times).
- Manually re-read every edited file after editing to confirm rendered JSX/behavior is identical (only import statements and genuinely-dead code removed).

## Behavior-risk items needing human review

- None outstanding. The one risky misstep (the three `view.tsx` files) was caught by `tsc` and reverted before finishing; `git status` confirms they are unmodified.
