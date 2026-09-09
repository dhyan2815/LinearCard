# LinearCard Project Memory

## Overview
LinearCard generates digital passes for Google Wallet (and Apple Wallet) using service account credentials and signed JWTs.

## Current Architecture
- **Language/Runtime**: Node.js (ES Modules), Next.js 16 (App Router), React 19
- **Design System**: Linear-inspired dark mode theme, glassmorphism, responsive 3D card tilt & live preview, `lucide-react`, `qrcode.react`, `canvas-confetti`
- **Backend API**: [`/api/generate-pass`](file:///c:/Users/dhyan/Desktop/LinearCard/app/api/generate-pass/route.js) for on-the-fly RS256 JWT pass creation and Google Wallet link generation.
- **Google Wallet Integration**: Issues signed JWT `savetowallet` links containing `genericClasses` and `genericObjects` that directly open and save passes to Google Wallet on Android / web.

### Changelog

### Core Next.js & UI Architecture
- **2026-08-26**: Converted the project into a complete Next.js App Router web application. Configured Tailwind CSS v4 and built interactive Linear-style dark UI with live 3D preview.
- **2026-08-31**: Implemented global dark/light mode toggle and executed codebase-wide styling migration to semantic color tokens.
- **2026-09-03**: Migrated UI framework from custom hand-rolled primitives to **shadcn/ui**. Replaced hardcoded styles and updated components to use `cn()` utility.
- **2026-09-05**: Fixed Tailwind CSS v4 non-canonical class warnings (`suggestCanonicalClasses`) across `components/HeroPass.tsx` and `app/page.tsx`.
- **2026-09-06**: Executed `/git-smart-commit` workflow on `dev` branch. Verified production build passes (`npm run build`).

### Google Wallet & API Integration
- **2026-08-26**: Replaced outdated `@passmint/node` direct-signing calls with standard Google Wallet JWT signing using `jsonwebtoken` and Node `crypto`.
- **2026-08-26**: Created `lib/google-wallet.js` for modular cryptographic pass generation and `/api/generate-pass/route.js` API route for live pass signing.
- **2026-08-26**: Created `update-pass.mjs` script to prototype live pass updates via the Google Wallet REST API. Used official `google-auth-library`.
- **2026-09-02**: Implemented PassTemplate CRUD & Publish API (`/api/templates`), syncing `GenericClass` with Google Wallet API.
- **2026-09-07**: Clarified hardcoded OTP (`1234`) behavior during local development while WAHA is temporarily disabled. Enhanced `WhatsappService.sendOtp` and `wahaPost` in `apps/api` to log payload and dev OTP to console.
- **2026-09-07**: Fixed `TypeError: Invalid URL` in `NotificationsController.getnotificationslog` and `PassesController.getcheckclass`. Removed extraneous `new URL(req.url)` calls that broke on relative Express request URLs, correctly relying on Express `req.query`.
- **2026-09-07**: Resolved `404 Not Found` and `SyntaxError: Unexpected token '<'` JSON parse errors on the frontend when loading member profiles and the live activity dashboard. Updated `LiveManageView`, `LiveActivitySidebar`, and `members/[id]/page.tsx` to use the unified `apiClient` instead of standard `fetch('/api/...')`, properly stripping the legacy Next.js `/api/` prefix and routing requests directly to the NestJS backend on port 3001.
- **2026-09-08**: Updated `WalletService.createGenericClass` to emit `locations[]` mapped from `templateData.locations` (capped at max 10 locations) to support Google Wallet OS-level proximity notifications. Added unit test suite `wallet.service.spec.ts`.
- **2026-09-08**: Updated `TemplatesController.publishTemplate` to forward `storeLocations` (with fallback to `[]`) to `WalletService.createGenericClass`. Added unit test suite `templates.controller.spec.ts`.
- **2026-09-08**: Added `PATCH /templates/:id` endpoint to `TemplatesController` supporting draft updates and `storeLocations` validation (array check, max 10 entries, latitude [-90, 90], longitude [-180, 180]). Added comprehensive unit tests in `templates.controller.spec.ts`.


### Database, Auth & Security
- **2026-08-29**: Switched from in-memory to SQLite database via Prisma. Seeded database with multi-tenant mock data. Implemented full backend API integration for consumer OTP routes.
- **2026-09-01**: Deleted the `prisma` directory since the migration to Supabase is complete.
- **2026-09-02**: Implemented OTP Security Hardening. Added `lib/otp.ts` exporting SHA-256 `hashOtp`, timing-safe `verifyOtp`, and DB-driven `isOtpRateLimited`.
- **2026-09-02**: Implemented Supabase Schema Migrations (PassTemplate, AuditLog, NotificationLog).
- **2026-09-08**: Created Supabase migration `20260908000000_add_store_locations_to_pass_template.sql` adding `storeLocations` JSONB column with default `'[]'::jsonb` to `PassTemplate` for Google Wallet proximity location support.

### Dashboard & Operations
- **2026-08-26**: Migrated all CLI script operations into the unified Next.js dashboard UI (Design Template, Issue Passes, Manage Live).
- **2026-09-02**: Implemented Template Builder UI, Notification Delivery Ledger, Notifications Composer UI, and Member Detail Page with Audit Trail.
- **2026-09-03**: Implemented Dashboard Overview Polish + Settings Tab. Resolved 6 post-sprint polish issues.
- **2026-09-03**: Integrated Members tab into single-page dashboard layout, added tenant-aware filtering for stats and member passes.
- **2026-09-08**: Implemented Store Locations editor in `TemplateWorkspace` and pre-population on load in dashboard `page.tsx` for Google Wallet OS-level proximity notifications. Supports adding, editing, removing up to 10 geofenced coordinates with label and lat/lng validation, saving via `PATCH /templates/:id` draft sync, and auto-populating existing locations when loading tenant templates.

### Documentation & Workflows
- **2026-08-29**: Conducted a full codebase audit and generated `LinearCard_Architecture_Briefing.md`.
- **2026-08-30**: Created `LinearCard_User_Flows.md`.
- **2026-08-31**: Created comprehensive 8-flow manual testing guide (`LinearCard_Manual_Testing_Guide.md`).
- **2026-09-03**: Authored complete E2E testing guide `docs/LinearCard_E2E_Testing_Guide.md`.
- **2026-09-05**: Renamed primary git branch to `master` and created `dev` branch.
- **2026-09-06**: Untracked `docs/` folder from git using `git rm -r --cached docs/`.
- **2026-09-06**: Executed `/git-smart-commit` workflow on `dev` branch. Verified production build passes (`npm run build`). Committed `next-env.d.ts` removal and `.gitignore` update (`chore: ignore and untrack next-env.d.ts`) and expanded Tech Stack documentation (`docs: expand tech stack breakdown in README`), then pushed to `origin/dev`.
- **2026-09-06**: Opened Pull Request #1 from `dev` to `master` containing the new interactive 3D HeroPass component, tech stack documentation updates, and repository maintenance chores.
- **2026-09-06**: Switched to `master` branch and successfully merged Pull Request #1, syncing the local `master` branch with `origin/master`.
- **2026-09-06**: Restructured project into Turborepo monorepo workspace. Moved Next.js application to `apps/web`, configured root `package.json`, `turbo.json`, and npm workspaces (`apps/*`, `packages/*`). Verified `npm run build` and `npm run dev` start cleanly via Turborepo.
- **2026-09-07**: Created shared types package `@linearcard/types` at `packages/types` with initial `User` interface, and linked it as a dependency in `apps/web/package.json`. Verified monorepo builds cleanly.
- **2026-09-07**: Configured Turborepo task pipeline (`turbo.json`) and root `package.json` scripts with `dev`, `build`, `start`, and `lint`. Added `dev` script to `apps/api/package.json` to enable concurrent monorepo dev mode. Updated `README.md` to document the Turborepo monorepo architecture, NestJS backend (Port 3001), Next.js frontend (Port 3000), shared `@linearcard/types` package, and monorepo scripts.
- **2026-09-07**: Completed full Turborepo + NestJS migration on `refactor/split-frontend-backend` branch via 7-task subagent-driven development workflow. Migrated all Next.js API routes to NestJS controllers (`apps/api`). Established `@linearcard/types` shared package. Created `apiClient` utility in frontend. Enforced strict separation (no DB/Wallet logic in `apps/web`). Removed residual backend dependencies from frontend. Moved backend tests to `apps/api/tests`. Full monorepo build verified (`turbo run build`). HEAD: `03dadcf`.
- **2026-09-07**: Resolved `Missing Supabase environment variables` startup error in NestJS `apps/api`. Implemented `apps/api/src/env.ts` to locate and load the root monorepo `.env` file across candidate directories prior to Nest module initialization, imported into `main.ts` and `supabase.service.ts`, and freed lingering zombie node processes holding port 3001. Verified concurrent startup via `npm run dev` and verified build via `npm run build`.
- **2026-09-07**: Removed rogue `superpowers` repository clone (`main` branch) from `C:\Users\dhyan\.gemini\config\plugins\superpowers` which was auto-detected by IDE Git Source Control as a workspace repository/worktree. Cleaned up legacy `.superpowers/` and `docs/superpowers/` metadata directories from LinearCard project root.
- **2026-09-07**: Resolved 307 redirect error during admin OTP verification. Enabled CORS credentials in `apps/api/src/main.ts`, implemented `adminSendOtp` and `adminVerifyOtp` in `auth.controller.ts` with JWT issuance and dev fallback (`1234`), stored `admin_session` cookie in `apps/web/app/login/page.tsx` for Next.js middleware compatibility, and updated `apiClient` to send `Authorization: Bearer <token>` and `credentials: 'include'`. Standardized `JWT_SECRET` fallback and fixed `/admin/login` redirects in `SettingsView.tsx`.
- **2026-09-07**: Opened Pull Request #2 from `refactor/split-frontend-backend` into `dev` detailing the architectural intent, Turborepo structure, NestJS backend migration, shared types package, and security boundaries.
- **2026-09-07**: Verified PR #2 had zero merge conflicts, resolved TypeScript-ESLint linting errors and unused variables across `apps/api`, verified monorepo build passes cleanly (`turbo run build`), and successfully merged Pull Request #2 into `dev` branch. Checked out and synchronized local `dev` branch with `origin/dev`.
- **2026-09-07**: Deleted branch `refactor/split-frontend-backend` from both local environment and remote `origin`.
- **2026-09-07**: Enriched `apps/web/docs/LinearCard_Project_Context.md` with deep architectural connections: added complete 11-step enrollment data flow, `WalletService` internal call graph, real-time update `Promise.all` async pattern rationale, dual-token admin auth chain, Template→GenericClass→GenericObject ID coupling, OTP security primitives, notification logging audit trail architecture, full 8-table data model with FK relationships, environment variables reference table, and NestJS module registry table.
- **2026-09-07**: Installed skills from `obra/superpowers` into `.agents/skills`. Added 14 core skills (`brainstorming`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `using-superpowers`, `verification-before-completion`, `writing-plans`, and `writing-skills`) to project-level workspace customizations.
- **2026-09-07**: Conducted MoM-driven brainstorming session on Proximity Notification (geo-fencing) feature. Confirmed Google Wallet API cannot expose user location during issuance. Established two plan directions: Plan A (native ~150m OS geofence via Google Wallet `locations[]`) and Plan B (custom 5km Haversine check via B1 Active Web Check-in, B2 Native App FCM Push, B3 External Trigger). Wrote full implementation specs saved to `docs/superpowers/plans/2026-09-07-plan-a-native-proximity.md` and `docs/superpowers/plans/2026-09-07-plan-b-web-geofencing.md`.
- **2026-09-08**: Implemented Plan A — Google Wallet Native Proximity Notification. Added `storeLocations` JSONB column to `PassTemplate` (Supabase migration), mapped `locations[]` into `GenericClass` payload in `WalletService.createGenericClass`, added `PATCH /templates/:id` endpoint with lat/lng validation in `TemplatesController`, and built store locations editor UI in `TemplateWorkspace` with round-trip load support.
- **2026-09-08**: Enriched `docs/superpowers/plans/2026-09-07-plan-a-native-proximity.md` with: (1) Notification behavior table covering entry-only trigger, spam protection, OS throttling, delivery delay, and Android-only platform constraint. (2) Architectural justification for placing `locations[]` on `GenericClass` vs `GenericObject` with scalability rationale. (3) Rejected alternatives table covering PWA/Service Worker geofencing and AddMessage API. (4) Replaced raw lat/lng number inputs in Task 5 with smart `StoreLocationEntry` sub-component featuring Google Places Autocomplete address search and browser geolocation "Detect My Location" button. (5) Appended Task 8: Post-Implementation Testing Guide covering brand admin Google Console verification, end-user couch test, Android emulator GPS spoofing, and real-world walk-in test methods.
- **2026-09-08**: Verified and corrected the implementation of Plan A Task 5. Replaced the raw manual `<Input type="number">` fields in `TemplateWorkspace.tsx` with a new `StoreLocationEntry` component that uses the `navigator.geolocation` API to provide a one-click "Detect My Location" button, vastly improving the UX for brand admins setting up geofences.
- **2026-09-09**: Executed `/migrate-workflows` to migrate legacy global workflows (`git-smart-commit.md`, `code-refactoring.md`, `readme-generator.md`) to modern skills under `~/.gemini/config/skills/` (`git-smart-commit/SKILL.md`, `code-refactoring/SKILL.md`, `readme-generator/SKILL.md`). Safely archived original `.md` workflow files as `.md.bak`.