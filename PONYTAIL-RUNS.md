# Ponytail Refactor Plan — Segmented Runs

Weekly maintenance pass. Codebase is split into three independent sessions so each stays small, cheap, and conflict-free. Paste each run's prompt into a **fresh Claude Code session** — do not chain them in one conversation. Each run only depends on files on disk, never on prior chat context.

Ponytail effort level for all runs: **medium**.

> ## ⚠️ Hard Constraint — Refactor Only, No Behavior Changes
> Every run below (backend, frontend, sanity check) must be **pure refactoring**:
> shorter, cleaner, simpler code that is **functionally identical** to what it
> replaces. Do not change what any function, endpoint, component, or flow does,
> returns, or renders. No behavior tweaks, no bug fixes, no logic changes, no
> new features, disguised as refactoring. If a real functional issue is
> noticed, note it in the report instead of fixing it. This constraint is
> non-negotiable and must be obeyed in all three runs.

---

## Run 1 — Backend (`apps/api`)

Paste this into a new session:

```
/ponytail medium

HARD CONSTRAINT: refactor only, zero functional changes. Every function,
endpoint, and flow must behave exactly as before — same inputs, same outputs,
same side effects. Do not fix bugs, change logic, or alter behavior even if
you spot something wrong; note it in the report instead. If unsure whether a
simplification changes behavior, skip it and note it as skipped.

Scope: apps/api only (NestJS backend). Do not touch apps/web or packages/types.

Go through the backend source under apps/api/src and apply the ponytail ladder:
remove dead code, collapse unnecessary abstractions, cut boilerplate, prefer
stdlib/already-installed deps, shorten anything that can be shortened without
changing behavior. Preserve tenant-scoping (.eq('tenantId', ...)), Google
Wallet flows, and existing error handling — do not simplify away trust-boundary
validation or security checks.

When done, write a single Markdown report to the repo root at
PONYTAIL-BACKEND-REPORT.md summarizing:
- files touched and a one-line reason per file
- lines removed vs added (rough count)
- patterns/abstractions removed
- anything flagged but deliberately skipped, and why
- any behavior-risk items that need human review

Keep the report concise — bullet points, no prose padding.
```

**Output:** `PONYTAIL-BACKEND-REPORT.md` at repo root.

---

## Run 2 — Frontend (`apps/web`)

Paste this into a separate new session:

```
/ponytail medium

HARD CONSTRAINT: refactor only, zero functional changes. Every component,
page, and flow must behave and render exactly as before — same UI output,
same interactions, same data flow. Do not fix bugs, change logic, or alter
behavior even if you spot something wrong; note it in the report instead. If
unsure whether a simplification changes behavior, skip it and note it as
skipped.

Scope: apps/web only (Next.js 16 frontend). Do not touch apps/api or packages/types.

Go through the frontend source under apps/web/app and apps/web/components and
apply the ponytail ladder: remove dead code, collapse one-off abstractions,
cut boilerplate, prefer native platform features and already-installed deps
over new code, shorten anything that can be shortened without changing
behavior or UI output. Preserve accessibility basics and existing error
handling.

When done, write a single Markdown report to the repo root at
PONYTAIL-FRONTEND-REPORT.md summarizing:
- files touched and a one-line reason per file
- lines removed vs added (rough count)
- patterns/abstractions removed
- anything flagged but deliberately skipped, and why
- any behavior-risk items that need human review

Keep the report concise — bullet points, no prose padding.
```

**Output:** `PONYTAIL-FRONTEND-REPORT.md` at repo root.

---

## Run 3 — Sanity Check / Diagnostic

Run this **after** Run 1 and Run 2 have both produced their reports. Paste into a third new session:

```
Do a sanity check on a recent ponytail refactor pass. The refactor was scoped
to be behavior-preserving only (no functional changes allowed), so your
verification's main job is confirming that constraint held — treat any
behavior difference as a regression to report, not an acceptable side effect.

Do NOT scan the whole repository — that's slow and expensive. Instead:

1. Read only PONYTAIL-BACKEND-REPORT.md and PONYTAIL-FRONTEND-REPORT.md at
   the repo root.
2. From the files/changes each report claims, build a short verification
   plan: which builds/lints/tests to run, and which specific changed files
   are worth a targeted diff read (not a full-repo scan) because they touch
   tenant isolation, auth, Wallet signing, or payment/webhook code.
3. Execute that plan: run `npm run build`, `npm run lint`, and relevant test
   suites (apps/api `npm run test`); spot-check the flagged files directly.
4. Write PONYTAIL-VERIFICATION-REPORT.md at repo root with: pass/fail per
   check, any regressions found, and a final verdict on whether the two
   refactor passes are safe to keep.

Keep this targeted and token-efficient — read the two reports and the files
they point to, not the codebase at large.
```

**Output:** `PONYTAIL-VERIFICATION-REPORT.md` at repo root.

---

## Cadence

Repeat this three-run cycle weekly (or before a release) so the codebase doesn't accumulate the slop a single monolithic refactor pass would miss.
