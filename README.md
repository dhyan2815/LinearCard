# LinearCard

![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-EF4444?style=flat-square&logo=turborepo)
![Next.js](https://img.shields.io/badge/Next.js-16%20(App%20Router)-black?style=flat-square&logo=next.js)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase)

**LinearCard** is a premium, multi-tenant digital pass platform for Google Wallet (with Apple Wallet planned). It combines a sleek Linear-inspired dark mode admin dashboard, real-time 3D pass previews, enterprise-grade backend infrastructure, and a complete loyalty & redemption engine with order-linked points tracking.

LinearCard enables brands to issue, manage, and dynamically update digital passes directly via the Google Wallet REST API using RS256 JWT signing. Includes staff QR scanner, multi-channel campaigns (WhatsApp + Google Wallet push), real-time member CRM, and full GDPR-aligned audit trails. Built as a Turborepo monorepo with Next.js 16 frontend, NestJS 10 backend, and shared TypeScript types.

---

## ✨ Features

- **Google Wallet Integration:** RS256 JWT signing, real-time pass updates via REST API, discoverable save callbacks, promotional push notifications (`addMessage`), and proximity-based geofence notifications.
- **Premium Design System:** Linear-inspired dark mode UI, glassmorphism, responsive 3D card preview, live template editing with real-time pass sync.
- **Multi-Tenant Isolation:** Application-level tenant filtering, RLS policies on Supabase, separate webhook configurations, and per-tenant Google Wallet class namespacing.
- **Consumer Onboarding:** Mobile-first enrollment flow, 4-digit OTP verification (SHA-256 hashed), marketing consent tracking (DPDP Phase 7.6).
- **Admin Dashboard:** 
  - Nested App Router pages: Template Designer, Live Activity, Push Campaigns, Members, Settings, POS Simulator.
  - Pass Template CRUD with preset catalog (Coffee Loyalty, Gym, Event Tickets, Travel Tickets).
  - Program & Tier management—each tier maps to its own Google Wallet class.
  - Live member balance adjustments with real-time wallet sync.
  - Full audit trails and consent logs.
- **Loyalty & Redemption Engine:** Order-linked points award/redeem, tier computation on every transaction, WhatsApp tier-up notifications, 10% earn and up-to-50% discount preview.
- **Multi-Channel Campaigns:** Send-now broadcasts with audience segmentation (tier, balance, inactivity, test-account), chunked delivery (25/batch), and per-campaign delivery reporting.
- **Staff Scanner (`/scan`):** QR/barcode scanning, real-time member lookup, order amount entry, and transaction history.
- **Webhook Integrations:** Google Wallet save callback (JWS verification), WhatsApp inbound (`STOP`/`START` opt-out), payment simulator with HMAC-SHA256 signature.
- **Idempotency (Phase 7.1):** Global interceptor ensures POST/PUT/PATCH/DELETE execute at most once per `Idempotency-Key`.
- **Security:** HTTP-only JWT cookies, timing-safe OTP verification, rate-limited attempts (5 max), verified Google JWS callbacks, HMAC webhook signing.

## 🛠 Tech Stack

### Monorepo & Tooling
- **Build System:** [Turborepo](https://turbo.build/) for task pipeline orchestration, caching, and concurrent development
- **Workspaces:** npm workspaces (`apps/*`, `packages/*`)
- **Shared Packages:** `@linearcard/types` (`packages/types`) providing shared TypeScript data models (User, Tenant, Member, Pass) across apps

### Frontend (`apps/web`)
- **Framework:** Next.js 16 (App Router, Port `3000`)
- **UI Library:** React 19 (TypeScript enabled)
- **Styling:** Tailwind CSS v4 (with PostCSS)
- **Component System:** shadcn/ui (Radix UI primitives, `class-variance-authority`, `clsx`, `tailwind-merge`)
- **Animations:** Motion (Framer Motion 13) & `canvas-confetti`
- **Icons & Fonts:** `lucide-react`, Geist
- **Utilities:** `qrcode.react` (QR generation), `@yudiel/react-qr-scanner` (live QR scanning)
- **API Client:** Type-safe HTTP client (`lib/api-client.ts`) communicating with the NestJS backend via `NEXT_PUBLIC_API_URL`

### Backend (`apps/api` — NestJS 10 + Google Wallet)
- **Framework:** NestJS 10 (Port `3001`), TypeScript
- **Ten Core Modules:**
  1. **AuthModule** — OTP generation (4-digit), SHA-256 hashing, timing-safe verification, rate-limiting (5 attempts), JWT issuance for admins, dev OTP bypass.
  2. **DashboardModule** — Tenant metrics, pass statistics, program overview, analytics queries.
  3. **MembersModule** — CRM: member profiles, loyalty point balances, pass lifecycle, cascading deletion on member erase/purge.
  4. **NotificationsModule** — Notification log, inbound WhatsApp webhook (`POST /notifications/webhooks/whatsapp-inbound`) for `STOP`/`START` opt-out, WhatsAppProvider interface.
  5. **PassesModule** — Pass issuance, live balance updates via REST API, redemption processing, scan history, webhook callbacks.
  6. **TenantModule** — Tenant profiles, customizable webhook URLs, per-tenant isolation.
  7. **WalletModule** — Google Wallet REST API integration, RS256 JWT signing (`jsonwebtoken`), GenericClass/GenericObject creation, promotional messages, discoverable callback handler.
  8. **TiersModule** — Tier lifecycle management, pure `computeTier()` function for tier evaluation, upgrade/downgrade detection, WhatsApp notifications.
  9. **ProgramsModule** — Program CRUD, preset catalog (Coffee Loyalty, Gym, Event Tickets, Travel Tickets), per-program tier editing, publish (one Google Wallet class per tier).
  10. **CampaignsModule** — Send-now campaigns, audience segmentation (tier/balance/inactivity/test-account), dry-run preview, chunked dispatch (25/batch), delivery reporting via `NotificationLog.campaignId`.
- **Database:** Supabase (PostgreSQL), RLS policies (Phase 7.3), application-level tenant filtering (service-role bypasses RLS).
- **Audit Trail:** `AuditLog` (all transactions), `ConsentLog` (member consent), `NotificationLog` (delivery tracking).
- **Security Patterns:** HTTP-only JWT cookies, SHA-256 OTP hashing, JWS signature verification (Google Wallet callbacks), HMAC-SHA256 webhook signing, idempotency interceptor (Phase 7.1).
- **Google Wallet:** `google-auth-library`, RS256 signing, 3-hour JWT expiry, async REST updates, resilient error handling.
- **Data Protection (Phase 7.6):** `GET /members/:id/export` returns full data principal export, `DELETE /members/:id` anonymises (erase mode) or hard-deletes (purge mode).
- **Testing:** Jest + Supertest (controller & service layers), E2E tests via `test/jest-e2e.json`.

### Shared Types (`packages/types` — @linearcard/types)

Monorepo-wide TypeScript interfaces, published to both frontend and backend via npm workspaces:

- **Core Domain:** `User`, `Tenant`, `Member`, `Pass`, `PassTemplate`, `Program`, `Tier`, `Admin`.
- **Audit & Compliance:** `AuditLog`, `ConsentLog`, `NotificationLog`.
- **Program/Tier Design:** 
  - `Program`: `kind` field (`'loyalty'` | `'ticket'`), owns multiple `Tier` rows and `PassTemplate`s.
  - `Tier`: DB row with `minPoints`, `templateId`, `sortOrder` — source of truth for tier thresholds (Phase 3 dropped `PassTemplate.tierThresholds`).
  - `tier`: computed field on `Member` and `Pass` (tier name at runtime).
- **Wallet Integration:** Pass state including loyalty points, barcode, QR, member consent, marketing opt-out (`marketingOptOutAt`).
- **Hot-Reload:** Uses `*` version specifier in workspace dependents — frontend & backend pick up type changes instantly without rebuild/republish.
- **Import Path:** `@linearcard/types` (npm workspace alias resolution).

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18 or later
- npm v10 or later (with workspace support)
- Supabase Project (Database)
- Google Cloud Service Account (with Google Wallet API access)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/linearcard.git
   cd linearcard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   - **Frontend (`apps/web/.env`):**
     ```env
     NEXT_PUBLIC_API_URL=http://localhost:3001
     ```
   - **Backend (`apps/api/.env`):**
     Ensure Google Cloud credentials (`GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_ISSUER_ID`), Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `JWT_SECRET`, and `WALLET_CREDENTIALS_KEY` (encrypts per-tenant Google Wallet private keys at rest — generate with `openssl rand -hex 32`) are configured. Both `JWT_SECRET` and `WALLET_CREDENTIALS_KEY` are validated at boot and the API refuses to start without them.

4. **Run the development servers:**
   Launch both Next.js frontend and NestJS backend concurrently via Turborepo:
   ```bash
   npm run dev
   ```

5. **Access the Applications:**
   - **Frontend Dashboard & Web App:** `http://localhost:3000`
   - **Backend NestJS API:** `http://localhost:3001`

### Available Monorepo Scripts

Run from the root directory:
- `npm run dev` — Concurrently starts `apps/web` (Next.js on Port 3000) and `apps/api` (NestJS on Port 3001) in watch mode.
- `npm run build` — Compiles all applications and shared packages using Turborepo caching.
- `npm run start` — Starts production servers.
- `npm run lint` — Runs linters across workspaces.

---

## 🏗 Key Architectural Patterns

- **Workspace Isolation:** Frontend (`apps/web`) and backend (`apps/api`) are separate npm workspaces with shared types in `packages/types`.
- **Type Safety:** `@linearcard/types` defines all DTOs; both frontend and backend import from the same source via `*` version specifier (instant hot-reload).
- **API-First:** Frontend routes all requests through `lib/api-client.ts` (single fetch wrapper) to backend at `${hostname}:3001`.
- **No Job Queue (Phase 7.4):** Campaign sends and pass resyncs run **synchronously** inside the request (consequence: sends that outlive the request do not resume on restart).
- **Tier Computation:** Pure `computeTier()` function evaluates loyalty points against program `Tier` rows on every transaction; detects upgrades/downgrades; triggers tier-up WhatsApp notifications.
- **Stable Field Binding:** Pass templates bind Google Wallet generic fields by stable `col.key` (not position), ensuring correct mapping across template edits.
- **`applyRaw` Escape Hatch:** `createGenericClass` accepts `templateData.rawClass` and `createGoogleWalletPass` accepts `options.rawObject` — deep-merged into payload before Google request (unmodelled Wallet fields stay in template row, not code).

---

## 🗂 Project Structure

```
linearcard/
├── apps/
│   ├── api/                   # NestJS Backend Application (Port 3001)
│   │   ├── src/
│   │   │   ├── auth/          # OTP generation, verification & auth controllers
│   │   │   ├── dashboard/     # Tenant dashboard stats and analytics
│   │   │   ├── members/       # CRM member management & pass lookup
│   │   │   ├── notifications/ # Push & WhatsApp delivery services
│   │   │   ├── passes/        # Pass generation, updates & template management
│   │   │   ├── tenant/        # Tenant configuration & webhook controllers
│   │   │   ├── wallet/        # Google Wallet cryptographic JWT signing
│   │   │   ├── app.module.ts  # Root application module
│   │   │   └── main.ts        # Entry point (Port 3001, CORS enabled)
│   │   ├── test/              # NestJS e2e test suite
│   │   └── package.json
│   └── web/                   # Next.js Frontend Application (Port 3000)
│       ├── app/               # App Router pages (Dashboard, Scanner, Enrollment, Login)
│       ├── components/        # Reusable UI components (HeroPass, ThemeToggle, etc.)
│       ├── lib/               # Typed apiClient & frontend helpers
│       ├── public/            # Static assets and tenant branding
│       └── package.json
├── packages/
│   └── types/                 # Shared TypeScript types (@linearcard/types)
│       ├── index.ts           # Shared data models (User, Tenant, Member, Pass)
│       └── package.json
├── docs/                      # PRDs, architecture briefing, deployment, testing guides
├── plans/                     # Feature specs and design docs (e.g., proximity notifications)
├── supabase/migrations/       # Database schema versioning
├── turbo.json                 # Turborepo task pipeline configuration
├── package.json               # Root monorepo configuration & scripts
├── CLAUDE.md                  # Project-specific development guide
└── README.md
```

## 📚 Documentation & References

- **CLAUDE.md** — Comprehensive development guide (commands, architecture, patterns, troubleshooting).
- **Architecture Briefing:** `docs/LinearCard_Architecture_Briefing.md` — Deep-dive on all 10 backend modules, data flow, security patterns.
- **User Flows:** `docs/LinearCard_User_Flows.md` — Enrollment, admin dashboard, staff scanner, notification pipelines.
- **Testing:** 
  - Manual QA: `plans/LinearCard_Manual_Testing_Guide_v4.md`
  - Automated: `docs/LinearCard_E2E_Testing_Guide.md`
- **Deployment:** `docs/DEPLOYMENT_GUIDE.md` — Vercel build, Supabase migrations, env var setup.
- **Next.js Breaking Changes:** `AGENTS.md` — Auto-generated differences from Next.js 14/15.

## 🔄 Recent Implementation Phases

- **Phase 7.1 (Idempotency):** Global `IdempotencyInterceptor` for idempotent mutations (POST/PUT/PATCH/DELETE).
- **Phase 7.2 (Google JWS):** Implemented JWS signature verification for Google Wallet save callbacks; moved from JWT to ECv2SigningOnly.
- **Phase 7.3 (RLS):** Supabase Row-Level Security policies on tenant-owned tables (Phase 7.3); application-level filtering still required.
- **Phase 7.4 (Sync Execution):** Removed job queue; campaign sends and pass resyncs now run synchronously inside requests.
- **Phase 7.6 (DPDP):** Data export, erasure (soft-delete with anonymisation), and purge (hard-delete) endpoints for data principals.
- **Phase 7.7 (Save-Link Origins):** WALLET_SAVE_ORIGINS env var for cross-origin `savetowallet` link control.
- **Payment Gateway (Phase 5):** Webhook simulator with HMAC-SHA256 signing, replay protection, order-linked redemption engine.
- **Loyalty & Redemption:** Tier computation on every transaction, 10% earn preview, up-to-50% discount on redemption.

## Security & Compliance

### Authentication & Authorization
- **HTTP-only JWT Cookies:** Admin login uses SHA-256 hashed OTPs (4-digit, timing-safe verification).
- **Rate Limiting:** 5 wrong OTP attempts burn the session; brute-force protected.
- **Tenant Isolation:** Application-level filtering on every query; RLS policies on Supabase tables (Phase 7.3).

### Data Protection (Phase 7.6 — DPDP)
- **Data Export:** `GET /members/:id/export` returns complete data principal record.
- **Erasure:** `DELETE /members/:id?mode=erase` soft-deletes member, anonymises passes, retains audit trail.
- **Purge:** `DELETE /members/:id?mode=purge` hard-deletes member and related logs.

### Webhook Security
- **Google Wallet Callbacks (Phase 7.2):** JWS signature verification (ECv2SigningOnly ECDSA-P256), cached Google key validation, rejects unverifiable callbacks with 401.
- **Payment Webhooks:** HMAC-SHA256 signing, timestamp window (replay protection), per-tenant nonce validation.
- **WhatsApp Inbound:** Opt-out handling (`STOP`/`START` messages set `marketingOptOutAt`).

### Idempotency (Phase 7.1)
- **Global Interceptor:** Every POST/PUT/PATCH/DELETE can carry an `Idempotency-Key` header.
- **Guarantee:** Execute at most once; replay returns cached response with `Idempotent-Replay: true`.
- **Handled Errors:** Key collision (422), in-flight request (409), handler failure releases key for retry.
- **Frontend Integration:** `lib/api-client.ts` auto-generates idempotency keys for all mutations.

### Audit Trails
- **AuditLog:** All sensitive operations (pass creation, balance adjustments, OTP verification).
- **ConsentLog:** Member marketing consent tracking (GDPR-aligned).
- **NotificationLog:** Campaign delivery reporting with per-recipient status.

## 📄 License

This project is licensed under the MIT License.
