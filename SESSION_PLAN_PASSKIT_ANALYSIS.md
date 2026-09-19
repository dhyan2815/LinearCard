# LinearCard — Session Summary: PRD Gap Analysis + PassKit Feature Adoption Plan

**Date:** 2026-09-19
**Branch:** dev

---

## 1. Current Project Status vs. PRD v1

### ✅ Achieved (P0 Features)
- **Template Builder (~70%)** — live preview, draft/publish flow, colors/logos/hero images. Missing: immutable field keys separated from display labels.
- **Signup/OTP Flow (~90%)** — phone + OTP, E.164 normalization, WhatsApp OTP delivery, consent flag. Missing: consent versioning, audit trail.
- **Members/CRM (~60%)** — list/search/filter, member detail, pass history, audit log. Missing: segments, manual balance adjust UI, notes.
- **Scan/Redeem (~85%)** — QR scan, validate-pass endpoint, transaction history, points logic. Missing: real-time cross-wallet push post-redemption (`sync_delayed`).
- **Google Wallet Integration (~95%)** — pass creation, JWT signing (RS256), class suffixes, save notifications. Missing: `updatePass` endpoint.
- **WhatsApp Notifications (~90%)** — OTP, campaigns, pass links, NotificationLog. Missing: SMS/email channels.
- **Dashboard Stats (~50%)** — member/pass counts, tier distribution, wallet status. Missing: India vs GCC split, alerts.
- **Settings (~40%)** — webhook URL config, API key visibility. Missing: key rotation, webhook delivery ledger.

### ❌ Not Implemented (P0 Blockers)
- **Apple Web Service Protocol** — 0%. All 5 required endpoints missing (registration, unregistration, pass updates, log/error reporting). Flagged in PRD as "commonly underestimated."
- **Apple Wallet Pass Issuance** — 0%. No `.pkpass` generation, no certificate handling.
- **Notifications Composer** — 30%. WhatsApp only; SMS/email not wired.
- **Consent & Privacy Module** — 10%. No data subject rights actions, no consent versioning, no field sensitivity marking.
- **Analytics** — 20%. No India/GCC split, no channel performance tracking.

### 🚩 Critical Architecture Gaps
1. Field key vs. display label separation missing — renaming a label breaks pass identity.
2. No Google Wallet `updatePass` flow — redemptions don't push live to member's wallet.
3. Method B multi-tenant certificate handling incomplete for Apple.
4. No HMAC webhook signing / replay protection.
5. No idempotency keys on mutating endpoints.
6. Notification delivery ledger lacks per-channel status + retry logic.

### Open Questions (from PRD §11, still unresolved)
1. Payment-linked enrollment in v1 API or post-v1?
2. Direct-to-brand vs. embed/white-label GTM?
3. Feature-parity checklist vs. 7 competitors?
4. GCC country-specific PDPL variations (UAE vs Saudi)?
5. Numeric SLA for cross-wallet pass update propagation?
6. Numeric targets for success metrics?

---

## 2. PassKit TypeScript gRPC Quickstart — Deep Analysis

Repo cloned and reviewed: `passkit-typescript-grpc-quickstart`.

### Architecture Comparison

| Aspect | PassKit | LinearCard |
|---|---|---|
| Protocol | gRPC (ConnectRPC) | REST/HTTP |
| SDK | Generated from `.proto`, strongly typed | None — direct REST calls |
| Client init | Lazy Proxy pattern | Eager |
| Service org | Client-side modules (Images, Templates, Members...) | Server-side NestJS controllers |
| Template flow | `getDefaultTemplate()` → `Object.assign()` → `createTemplate()` | Direct upsert |
| Filters | Composable typed `FilterSchema` | Raw SQL-ish queries |
| Lists | `for-await` streaming | Manual pagination |
| Config | Validated at startup (fail-fast) | Validated lazily at request time |

### Key Patterns Worth Adopting
1. **Lazy client initialization (Proxy pattern)** — defer certificate/config loading until first API call.
2. **Unified SDK module abstraction** — `client.members.create()` instead of raw `apiClient('/members', ...)`.
3. **Config validation at startup** — fail fast with clear error list, not mid-request.
4. **Workflow/orchestration classes** — decouple use-case logic (enroll → issue pass → notify) from raw endpoints.
5. **Immutable-default + mutate pattern** for templates — clearer "starting state → desired state" flow.
6. **Typed filter composition** for list queries.
7. **Tier abstraction** — PassKit has Program → Tier → Member natively; LinearCard has no tier concept yet.
8. **Built-in member event streaming** — `listEventsForMember()` (check-in/out, point changes) vs. LinearCard's manual AuditLog.

### What NOT to Copy
- gRPC transport (REST is fine for v1 launch)
- Protobuf schemas (adds complexity; TypeScript/Supabase is sufficient)
- Strict archetype locking (LinearCard's field flexibility is a feature)
- Client-cert (mTLS) auth model (JWT is appropriate for LinearCard's brand-admin use case)

---

## 3. Executable Implementation Plan (Dev Branch)

### Tier 1 — Quick Wins (1–3 days each)
1. **Tier Management System** — new `Tier` table + CRUD controller (`apps/api/src/tiers/`), linked to `PassTemplate`; members get `tierId`. Enables Bronze/Silver/Gold progression.
2. **Field Key ↔ Label Separation** — add `fieldDefinitions JSONB` to `PassTemplate` (key/label/type/value), migrate existing `fieldRows`, update `PassPreviewCard` to bind by key.
3. **Google Wallet `updatePass` Endpoint** — `POST /passes/:id/update`, pushes balance/tier changes via `WalletService.updateGoogleWalletPass()`, called from scan page after redemption.
4. **Member Check-In/Out Events** — new `MemberEvent` table, `POST /members/:id/check-in|check-out`, `GET /members/:id/events`.

### Tier 2 — Foundations (2–3 days each)
1. **Config Validation at Startup** — `apps/api/src/config/config.validation.ts`, called in `main.ts` before `app.listen()`.
2. **Webhook HMAC Signing + Replay Protection** — `WebhookService` signs outbound payloads (timestamp + nonce + HMAC-SHA256); incoming validator checks signature/nonce/timestamp window.
3. **Idempotency Keys** — `IdempotencyKey` table + `IdempotencyService.checkOrRecord()`, required header on mutating endpoints (e.g. `generate-pass`).
4. **SMS/Email Channels** — Twilio (`SmsService`) + SendGrid (`EmailService`), wired into `notifications.controller.ts` alongside WhatsApp.

### Tier 3 — Architecture (3–5 days each)
1. **LinearCard SDK Wrapper** — new `packages/sdk/` workspace, `LinearCardClient` with `templates`/`members`/`passes`/`tiers`/`notifications` service modules, replacing raw `apiClient()` calls.
2. **Event Streaming Service** — `EventService` with typed `DomainEvent` (`member.enrolled`, `pass.redeemed`, etc.), stored in new `DomainEvent` table, emits to subscribers + fires webhooks; replaces ad-hoc `AuditLog` usage.

### Suggested Weekly Sequencing
- Mon: Tiers + field key/label separation
- Tue: Google Wallet updatePass + member check-in/out events
- Wed: Config validation + webhook HMAC signing
- Thu: Idempotency keys + SMS/Email channels
- Fri: SDK wrapper + event streaming service

**Total estimated effort:** ~15–18 days full scope; Tier 1 + partial Tier 2 realistically deliverable in one week.

---

## 4. Next Steps
- Confirm priority order with product owner (tiers vs. Apple Wallet protocol vs. webhook security).
- Decide whether Apple Web Service Protocol work starts in parallel (longest pole, PRD-flagged risk).
- Begin Tier 1 scaffolding on request.
