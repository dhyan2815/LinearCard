# LinearCard

![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-EF4444?style=flat-square&logo=turborepo)
![Next.js](https://img.shields.io/badge/Next.js-16%20(App%20Router)-black?style=flat-square&logo=next.js)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase)

**LinearCard** is a premium, multi-tenant digital pass platform for Google Wallet (Apple/Samsung planned later). It combines a Linear-inspired dark-mode admin dashboard, live 3D pass previews, a program-based loyalty & ticketing engine, and a full member CRM with WhatsApp + Google Wallet push notifications.

A tenant runs multiple **programs** (loyalty, tickets, coupons, membership, business cards…) created from presets. Each program owns its own pass templates, tiers, store locations, WhatsApp templates and enrollment slug — the entire dashboard is nested under the active program.

---

## ✨ Features

- **Google Wallet Integration:** RS256 JWT signing, per-tenant credentials (`WalletService.forTenant()`), live GenericObject updates via REST, discoverable save callbacks with JWS verification, promotional push messages.
- **Program-Scoped Dashboard (Phase 8):** every program gets its own Overview, Members, Activity, Campaigns, Design, Tiers, Locations, Messages and Settings tabs. Tier-less programs (tickets, business card, coupon) skip tier/points fields entirely.
- **Multi-Tenant Isolation:** application-level `tenantId` filtering on every query (service-role key bypasses RLS), RLS policies as a second line, per-tenant Google Wallet class namespacing.
- **Consumer Onboarding:** mobile-first enrollment (`/enroll/[slug]/[programSlug]`), 4-digit OTP (SHA-256 hashed, timing-safe), marketing consent tracking.
- **Loyalty & Redemption Engine:** order-linked points award/redeem, pure `computeTier()` tier evaluation on every transaction, WhatsApp tier-up notifications.
- **Multi-Channel Campaigns:** send-now broadcasts with audience segmentation (tier, balance, inactivity, test-account), chunked delivery, per-campaign delivery reporting.
- **Staff Scanner (`/scan`):** QR/barcode scan, member lookup, order entry, scan history.
- **Developer Platform:** hashed API keys, outbound webhooks (CRUD + test event) for `pass.installed`, `pass.deleted`, `points.awarded`, `points.redeemed`, `tier.changed`, `member.enrolled`.
- **Idempotency:** global interceptor honors `Idempotency-Key` on every mutating request; frontend `apiClient` attaches one automatically.
- **Audit Trail:** `AuditLog`, `ConsentLog`, `NotificationLog`, `WebhookDelivery` cover every sensitive action.
- **DPDP Compliance:** member data export, erase (anonymise) and purge (hard-delete) endpoints.

## 🛠 Tech Stack

### Monorepo & Tooling
- **Build System:** [Turborepo](https://turbo.build/)
- **Workspaces:** npm workspaces (`apps/*`, `packages/*`)
- **Shared Types:** `@linearcard/types` (`packages/types`) — types resolve from `index.ts`, runtime values from `dist/` (built by `dev:*`/`build`)

### Frontend (`apps/web`)
- Next.js 16 (App Router, Turbopack, Port `3000`), React 19, TypeScript
- Tailwind CSS v4, `framer-motion`/`motion`, `canvas-confetti`
- `qrcode.react` (generate), `@yudiel/react-qr-scanner` (scan), `@vis.gl/react-google-maps` (store locations)
- `lib/api-client.ts` — single fetch wrapper; browser calls go through the same-origin `/api/*` proxy defined in `next.config.mjs`

### Backend (`apps/api` — NestJS 10)
| Module | Purpose |
|---|---|
| `auth/` | Member OTP, admin OTP login, self-serve signup (demo mode), `TenantGuard` |
| `programs/` | Program CRUD from presets, tiers, publish, `sync-locations`, per-program overview/members/events |
| `templates/` | PassTemplate CRUD, publish (Google Wallet class), preview, resync-passes |
| `passes/` | Issuance (`PassIssuanceService`), `process-order`, `validate-pass`, scan history, `/p/:id` public save link, Wallet callback |
| `members/` | CRM, test-account flag, DPDP export/erase, balance adjustment |
| `campaigns/` | Send-now campaigns: preview (dry run), send, list, detail |
| `payments/` | PSP webhook (HMAC), webhook config, simulator |
| `developers/` | API keys, outbound webhooks |
| `notifications/` + `notification/` | Notification log, WhatsApp STOP/START, `WhatsappService`/`WhatsappProvider` (WAHA), OTP service |
| `wallet/` | Google Wallet REST + JWT save links, callback signature verification |
| `tiers/` | Pure `computeTier()` util |
| `tenant/`, `settings/` | Tenant lookup, business details, production approval |
| `dashboard/`, `audit/`, `supabase/` | Stats, `AuditService`, `SupabaseService` |

- **Database:** Supabase (PostgreSQL). Columns are camelCase. Service-role client bypasses RLS — every query filters `tenantId` explicitly; RLS policies exist as a second line.
- **No Job Queue:** campaign sends and pass resyncs run synchronously in-request.
- **Testing:** Jest (`*.spec.ts`, including `phase0…phase8` regression suites) + a single e2e smoke test.

### Shared Types (`packages/types`)
`Tenant`, `Member`, `Pass`, `PassTemplate`, `Program`, `Tier`, `AudienceFilter`, `Campaign`, `AuditLog`, `ConsentLog`, `NotificationLog`, `Admin`, and more — imported as `@linearcard/types` by both apps.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+, npm v10+ (workspaces)
- Supabase project
- Google Cloud service account with Google Wallet API access

### Installation

```bash
git clone https://github.com/dhyan2815/linearcard.git
cd linearcard
npm install
```

**Environment variables** — see `.claude/rules/env-variables.md` for the full reference. Minimum to boot:

- Root `.env` or `apps/api/.env`: `JWT_SECRET`, `WALLET_CREDENTIALS_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ISSUER_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`
- `apps/web/.env`: `API_ORIGIN=http://localhost:3001`

**Run the dev servers** — there is no combined `npm run dev`; the two apps restart on different triggers and an interleaved log stream hides which side is down. Use two terminals:

```bash
npm run dev:api
```
```bash
npm run dev:web
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

Publishing a template/program locally needs a public callback URL (ngrok) — see `PUBLIC_CALLBACK_URL` in the env reference.

### Available Root Scripts

- `npm run dev:api` / `npm run dev:web` — build `packages/types`, then run that app with auto-reload
- `npm run build` — compile all workspaces (Turborepo cached)
- `npm run lint` — ESLint `--fix` everywhere
- `npm run demo:reset` — wipe demo tenants listed in `DEMO_TENANT_IDS`
- `npm run kill-ports` — manual escape hatch when 3000/3001 are stuck (not run automatically)

---

## 🏗 Key Architectural Patterns

- **Multi-Tenant, Application-Level:** guarded routes read `req.tenantId` from `TenantGuard`; every query adds `.eq('tenantId', tenantId)`. Never trust a `tenantId` from body/query.
- **Programs Own Everything:** each program owns its templates, `Tier` rows, store locations, WhatsApp templates and enrollment slug; `kind` is `loyalty` or `ticket`.
- **Pass Issuance:** always through `PassIssuanceService.issueForMember()` — tier/points fields only written for programs with `Tier` rows.
- **Tier Computation:** pure `computeTier(balance, tiers)` run per transaction against the pass's own program; only real upgrades send WhatsApp.
- **Best-Effort Side Effects:** Wallet pushes, WhatsApp, and outbound webhooks run after the DB write, are logged on failure, and never roll back.
- **Idempotency:** global interceptor on POST/PUT/PATCH/DELETE when an `Idempotency-Key` header is present.
- **Wallet Save Links:** short-lived; `GET /p/:id` mints a fresh one on every visit — never cache them.

---

## 🗂 Project Structure

```
linearcard/
├── apps/
│   ├── api/                       # NestJS backend (port 3001)
│   │   └── src/                   # auth, programs, templates, passes, members, campaigns,
│   │                               # payments, developers, notifications, notification, wallet,
│   │                               # tiers, tenant, settings, dashboard, audit, supabase
│   └── web/                       # Next.js frontend (port 3000)
│       ├── app/
│       │   └── dashboard/
│       │       ├── _components/   # DashboardContext, DashboardSidebar, ProgramNav, ...
│       │       └── programs/[id]/ # overview, members, activity, campaigns, design, tiers,
│       │                          # locations, messages, settings
│       ├── components/
│       └── lib/api-client.ts
├── packages/
│   └── types/                     # @linearcard/types
├── supabase/migrations/           # schema migrations
├── docs/                          # architecture, patterns, edge cases, multi-tenant, webhooks
├── turbo.json
├── CLAUDE.md                      # Claude Code project guide
├── GEMINI.md                      # Gemini project memory
├── AGENTS.md                      # Next.js 16 API differences
└── README.md
```

## 📚 Documentation & References

- **CLAUDE.md / GEMINI.md** — development guide and project memory for AI assistants (commands, architecture, patterns)
- `docs/TROUBLESHOOTING.md`, `docs/PATTERNS.md`, `docs/EDGE_CASES.md`, `docs/MULTI_TENANT.md`, `docs/WEBHOOKS.md`
- `.claude/rules/backend.md`, `.claude/rules/frontend.md`, `.claude/rules/env-variables.md` — workspace-specific rules
- `AGENTS.md` — Next.js 16 breaking changes

## Security & Compliance

- **Auth:** HTTP-only JWT `admin_session` cookie (1 day) or `Authorization: Bearer`. OTP is 4-digit, 5-minute expiry, SHA-256 hashed, timing-safe compare, 5 wrong guesses lock the session. No dev bypass.
- **Tenant Isolation:** explicit `tenantId` filtering on every query; RLS as a second line.
- **Webhooks:** Google Wallet callbacks verified via JWS (ECv2SigningOnly); payment webhooks HMAC-SHA256 signed with replay protection; WhatsApp inbound handles `STOP`/`START` opt-out.
- **Idempotency:** `Idempotency-Key` guarantees at-most-once execution; replay returns the cached response.
- **DPDP:** `GET /members/:id/export` (data export), `DELETE /members/:id?mode=erase|purge`.
- **Audit:** `AuditLog`, `ConsentLog`, `NotificationLog`, `WebhookDelivery` record every sensitive action.

## 📄 License

MIT License.
