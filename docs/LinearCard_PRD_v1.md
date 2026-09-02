# LinearCard — Product Requirements Document (v1)

**Document owner:** Mayur
**Status:** Draft for team review
**Last updated:** July 28, 2026

---

## 1. Executive Summary

LinearCard is a **wallet-native loyalty, membership, and digital-identity platform** for brands in **India and the GCC**. It lets any brand — a café, a gym, a co-working space, an events company — issue loyalty passes, membership cards, ID cards, and access badges that live natively in **Apple Wallet, Google Wallet, and Samsung Wallet**, without the brand needing its own Apple Developer account, and with **WhatsApp** as a first-class way to reach members, not an afterthought.

The one-line pitch: **the fastest, least-friction way for a brand in India or the GCC to put a real wallet pass in a customer's pocket and talk to them there.**

---

## 2. Problem Statement

Brands in India and the GCC want to run loyalty and membership programs that live where customers actually are — their phone's lock screen and wallet app — instead of yet another app nobody opens. Today, doing this properly requires:

- Standing up **Apple Developer Program** membership (DUNS number, org verification, annual fee) just to issue passes — a multi-week, non-trivial process most SMB and even many enterprise marketing teams can't self-serve.
- Building or buying separate integrations for Apple Wallet, Google Wallet, and (increasingly) Samsung Wallet, each with different data models, signing requirements, and update mechanics.
- Reaching customers through channels that don't fit the region — push notifications and email have poor open rates in India and the GCC, where **WhatsApp is the dominant communication channel**, yet no existing loyalty/wallet platform treats WhatsApp as first-class.
- Meeting **India's DPDP Act** and **GCC PDPL** consent and data-handling requirements, which most global wallet platforms were not built around.

We've mapped seven direct competitors (Litecard, PassKit, Loopy Loyalty, WalletThat, PassEntry, Talon.One, TryBadge). Three of the seven still require the brand to hold its own Apple Developer account — a real, avoidable friction point. **None of them productize WhatsApp** as a delivery/engagement channel. That gap is LinearCard's core wedge.

**Cost of not solving this:** brands either don't adopt wallet-based loyalty at all (falling back to plastic cards or app-based loyalty with poor engagement), or they adopt a platform that's a poor regional fit — English-first, email/push-first, compliance-agnostic to Indian and Gulf law.

---

## 3. Goals

1. **Eliminate onboarding friction**: a brand can go from signup to a live, scannable wallet pass without ever touching an Apple Developer account. (Method B: single shared certificate, multi-tenant.)
2. **Make WhatsApp a first-class channel**, on par with wallet push, SMS, and email, for pass delivery, updates, and campaigns — the single biggest whitespace identified across all seven competitors.
3. **Support the full identity surface**, not just loyalty stamps: loyalty passes, membership cards, ID cards, and access badges, across Apple, Google, and Samsung Wallet.
4. **Be compliant by design** for India (DPDP Act) and GCC (PDPL) from day one — consent capture, data minimization, and phone-first identity (E.164 + OTP) built into the core data model, not bolted on.
5. **Give brands a self-serve path** from template design to live pass to first redemption, with a live preview, in a single session — no implementation partner required for the common case.

**Business goal:** win brands away from the "requires-your-own-Apple-account" competitors and from generic global platforms with no regional/compliance fit, using certificate-friction removal and WhatsApp as the explicit differentiators in marketing and sales.

---

## 4. Non-Goals (v1)

| Non-goal | Rationale |
|---|---|
| Samsung Wallet as a launch-blocking requirement | Gated behind Samsung's own partner program approval; Apple + Google cover the large majority of the addressable market at launch. Build the data model to support it, don't block v1 on it. |
| Payment processing / being a payment gateway | LinearCard triggers on and reflects payment/enrollment events (e.g., UPI-linked enrollment); it does not move money itself. |
| Becoming a full CRM or marketing automation suite | Members/CRM module covers what's needed to run a loyalty program (segments, history, notes); it is not meant to replace HubSpot/Salesforce-class tools. |
| Talon.One-style promotion/rules engine | Talon.One is explicitly scoped as a future **integration partner**, not something LinearCard rebuilds. |
| Native mobile apps for brand admins | Dashboard is web-first; a companion admin app is a future consideration, not v1. |
| Markets outside India and GCC | Phone-first identity, compliance model, and WhatsApp focus are tuned to these markets; global expansion is a later-phase decision, not a v1 goal. |

---

## 5. Target Users / Personas

- **Brand Admin (Marketing/Ops lead at the issuing brand)** — designs the pass template, launches campaigns, and reads analytics. Low-to-medium technical sophistication; needs a self-serve, visual workflow, not an API.
- **Brand Developer (occasional)** — for brands that want programmatic control, integrates via the v1 API (enrollment, webhooks, member updates). Technical; needs clear docs, idempotency, and reliable webhooks.
- **Front-line Staff (cashier / gate staff / gym reception)** — uses Scan/Redeem to validate and update passes in real time. Needs speed and zero ambiguity; may be on a basic Android device.
- **End Member/Customer** — signs up via phone number + OTP, receives the pass into their wallet app, gets updates over WhatsApp/wallet push/SMS/email, and presents the pass in-store or at a gate.
- **Compliance/Legal stakeholder (brand side)** — needs to see and trust the consent model to approve LinearCard for use under DPDP/PDPL obligations.

---

## 6. User Stories

### Brand Admin

- As a brand admin, I want to build a wallet pass template visually with a live preview, so that I don't need a designer or developer to launch a program.
- As a brand admin, I want to send a targeted notification to a segment of members over WhatsApp, wallet push, SMS, or email, so that I can reach them on the channel most likely to be seen.
- As a brand admin, I want to see India vs. GCC performance split in analytics, so that I can compare program health across my two markets.
- As a brand admin, I want to see which wallet platforms are connected (Apple, Google, Samsung) and their status, so that I know what's live vs. pending.

### Brand Developer

- As a brand developer, I want idempotency keys on all mutating API endpoints, so that retries from my system don't create duplicate members or passes.
- As a brand developer, I want HMAC-signed webhooks with timestamp/nonce replay protection, so that I can trust and verify events my systems receive.
- As a brand developer, I want a durable notification delivery ledger, so that I can audit whether a message was actually delivered.

### Front-line Staff

- As front-line staff, I want to scan a member's wallet pass and instantly see their status (valid/expired/points balance), so that I can serve them without delay.
- As front-line staff, I want redemption actions to update the pass in near-real-time across wallets, so that the member's app reflects the correct state immediately after use.

### End Member

- As a member, I want to sign up with just my phone number and an OTP, so that I don't need to create a new password or account.
- As a member, I want to receive my pass and updates over WhatsApp, so that I don't have to install a new app.
- As a member, I want to understand and control what data the brand has collected about me, so that I trust the program.

### Compliance Stakeholder

- As a compliance stakeholder, I want to see explicit, auditable consent capture at signup, so that I can confirm DPDP/PDPL obligations are met before approving the platform.

---

## 7. Functional Requirements

Requirements are grouped by the modules already scoped and reflected in the frontend prototype.

### 7.1 Dashboard — P0

- Single view summarizing active programs, member counts, recent activity, and wallet connection status.
- **Acceptance criteria:**
  - ☐ Shows counts for active passes issued per wallet platform (Apple/Google/Samsung).
  - ☐ Shows India vs. GCC split at a glance.
  - ☐ Surfaces at least one actionable alert state (e.g., "Samsung pending approval").

### 7.2 Template Builder — P0

- Wizard-based pass creation with **live pass preview** as the admin edits fields, colors, and layout.
- Must support the four pass archetypes: loyalty pass, membership card, ID card, access badge.
- Must separate **immutable field keys** from **display labels** (so a label can be renamed without breaking pass identity/back-end references).
- **Acceptance criteria:**
  - ☐ Admin can preview the pass as it will appear on Apple Wallet, Google Wallet, and Samsung Wallet before publishing.
  - ☐ Changing a display label does not change the underlying field key or break existing issued passes.
  - ☐ Template can be saved as draft and published independently.

### 7.3 Signup / OTP Flow — P0

- Phone-first identity: **E.164-formatted phone number + OTP** as the primary signup and auth mechanism.
- Consent capture is part of the signup flow, not a separate step that can be skipped.
- **Acceptance criteria:**
  - ☐ Signup requires a valid E.164 number and OTP verification before a pass is issued.
  - ☐ Consent text and scope are shown and explicitly accepted before data is stored.
  - ☐ Failed OTP attempts show a clear, specific error (expired code vs. wrong code vs. rate-limited).

### 7.4 Members / CRM — P0

- Member list with search/filter, individual member detail (pass status, activity history, notes).
- **Acceptance criteria:**
  - ☐ Admin can view a member's full pass and redemption history.
  - ☐ Admin can manually adjust a member's status/points with an audit trail entry.
  - ☐ Admin can segment members (e.g., by region, activity recency, tier) for targeted notifications.

### 7.5 Notifications Composer — P0

- Compose and send updates across **wallet push, WhatsApp, SMS, and email** from one interface.
- **Acceptance criteria:**
  - ☐ Admin can select one or more channels per notification.
  - ☐ Every send is recorded in the durable notification delivery ledger with per-channel delivery status.
  - ☐ Failed WhatsApp/SMS/email sends surface a reason and do not silently drop.

### 7.6 Scan / Redeem — P0

- Staff-facing scan interface (camera or handheld scanner input) to validate and redeem passes.
- **Acceptance criteria:**
  - ☐ Scan returns pass validity and current status within a low, predictable latency.
  - ☐ Redemption action updates the member's pass across all wallets holding it.
  - ☐ Invalid/expired/already-redeemed passes show an unambiguous rejection state.

### 7.7 Analytics — P1

- Program-level analytics with **India vs. GCC** as the primary comparative view, plus channel performance (which notification channel drives redemptions).
- **Acceptance criteria:**
  - ☐ Analytics view defaults to India vs. GCC comparison.
  - ☐ Admin can see notification channel performance (sent, delivered, opened where measurable, redemption-attributed).

### 7.8 Consent & Privacy Module — P0

- Central place for consent records, data subject requests, and visibility into what's collected, aligned to DPDP Act and GCC PDPL.
- **Acceptance criteria:**
  - ☐ Every member has a queryable consent record (what was consented to, when, version of the consent text).
  - ☐ Admin can action a data subject deletion/export request and see it logged.
  - ☐ Data model marks which fields are personal/sensitive for handling purposes.

### 7.9 Settings — P1

- Wallet platform connection status (Apple/Google connected, Samsung pending approval), API keys/webhooks, team access.
- **Acceptance criteria:**
  - ☐ Admin can see and rotate API keys.
  - ☐ Admin can configure webhook endpoints and see recent delivery attempts/failures.
  - ☐ Wallet connection status is accurate and reflects real platform state, not a static label.

---

## 8. Technical Requirements

These reflect architecture decisions already validated; included here so engineering and product share one source of truth.

- **Multi-tenant architecture: Method B (fully native)** across Apple, Google, and Samsung Wallet — one shared platform-owned certificate serving all tenant brands, rather than requiring each brand to provision its own.
  - Platform owns **annual certificate renewal**.
  - Strong **tenant isolation** required at the data and pass-generation layer.
  - **Per-tenant abuse monitoring** required to protect the shared certificate's standing with Apple/Google/Samsung.
- **Apple Web Service Protocol**: all **five required endpoints** must be implemented (registration, unregistration, retrieving updatable passes, retrieving the latest pass, and log/error reporting). This is flagged as the most commonly underestimated piece of the integration — scope it conservatively and don't compress its timeline.
- **API design principles:**
  - **Idempotency keys** required on all mutating endpoints.
  - **Webhooks** signed with **HMAC-SHA256**, including timestamp and nonce to prevent replay attacks.
  - A **durable notification delivery ledger** — every notification attempt, across every channel, is recorded with status, independent of the third-party channel's own reporting.
  - **Immutable field keys** are stored separately from **display labels** at the data model level (see Template Builder requirement above) — this is a data-model requirement, not just a UI convention.
- **Certificate & compliance checklist** (already completed, carry forward as launch gates):
  - Apple Developer Program: DUNS number + organizational account, held by LinearCard, not the brand.
  - Google Wallet Issuer verification.
  - Samsung Partner Agreement (gated — deferred, see Non-Goals).
  - Regional privacy law mapping: India DPDP Act, GCC PDPL.

---

## 9. Compliance Requirements

- **India — DPDP Act:** explicit, granular consent at signup; purpose limitation on data use; data subject rights (access, correction, deletion) must be actionable from the Consent & Privacy module, not just a policy statement.
- **GCC — PDPL:** equivalent consent and data-subject-rights handling, with attention to any GCC-country-specific variations (UAE, Saudi, etc. — this should be tracked as an open question below rather than assumed uniform).
- **Consent-first data model:** consent status and scope should be a first-class, queryable attribute on the member record, not metadata bolted onto a signup log.

---

## 10. Success Metrics

### Leading indicators (weeks)

- **Onboarding time-to-live-pass**: median time from brand signup to first live, scannable pass. Target: same-day for self-serve brands.
- **WhatsApp channel adoption**: % of brands that enable WhatsApp as a notification channel within their first 30 days. Target: majority adoption, given it's the core differentiator — specific target to be set once channel is live and we have a baseline.
- **OTP signup completion rate**: % of started signups that complete OTP verification.
- **Scan/redeem latency**: p95 response time for scan validation.

### Lagging indicators (months)

- **Brand retention**: % of brands still active (sending notifications / issuing passes) at 90 days.
- **Member pass retention**: % of issued passes still installed/active (not deleted from wallet) at 90 days.
- **India vs. GCC mix**: track program and member growth split by region to validate market strategy.
- **Competitive win rate**: track deals won citing "no Apple Developer account required" or "WhatsApp support" as the deciding factor.

*(Specific numeric targets are intentionally left open pending a launch baseline — see Open Questions.)*

---

## 11. Open Questions

- **[Product/Legal]** Should the payment-linked enrollment pattern (seen in PassEntry, relevant to UPI/tap-to-pay) be built into the v1 API spec now, or added post-v1? This is flagged as a decision that should be made before the API spec hardens further.
- **[Product]** Direct-to-brand GTM vs. embed/white-label GTM (referencing TryBadge's Pine Labs India model) — this materially affects onboarding flow design and API surface, and should be resolved before Template Builder and Signup flows are finalized for launch.
- **[Product]** What does a feature-parity checklist against all seven competitors surface as must-haves we haven't scoped yet?
- **[Legal]** Are there GCC-country-specific PDPL variations (UAE vs. Saudi vs. others) that require different consent handling, or is a single GCC-wide model sufficient for v1?
- **[Engineering]** What is the actual SLA/target for cross-wallet pass update propagation after a redemption (Scan/Redeem requirement above currently says "near-real-time" — needs a number)?
- **[Business]** What numeric targets should we set for the leading/lagging metrics above once we have a launch baseline?

---

## 12. Timeline Considerations

- **Samsung Wallet** is explicitly deferred pending Samsung Partner Agreement approval — this is an external dependency, not an internal scheduling choice, and should not block Apple/Google launch.
- **Apple Web Service Protocol** (5 endpoints) should be scoped and estimated conservatively given it's the most commonly underestimated piece of comparable integrations.
- Suggested phasing:
  - **Phase 1 (Launch):** Apple + Google Wallet, Method B multi-tenant architecture, Signup/OTP, Template Builder, Members/CRM, Notifications (WhatsApp/SMS/email/wallet push), Scan/Redeem, Consent & Privacy — all P0 items above.
  - **Phase 2:** Analytics depth, Settings/API key management polish, payment-linked enrollment (pending the open GTM decision), feature-parity gap closure.
  - **Phase 3:** Samsung Wallet (on partner approval), Talon.One integration partnership, GCC-specific compliance refinements if needed.

---

## 13. Competitive Differentiation Summary

| Differentiator | Status |
|---|---|
| Zero Apple Developer account required for brands | Validated advantage — 3 of 7 competitors still require this |
| WhatsApp as first-class engagement channel | Uncontested whitespace — 0 of 7 competitors have productized this |
| Phone-first identity (E.164 + OTP) | Built for Indian/GCC market norms |
| Consent-first data model (DPDP + PDPL) | Built in from day one, not retrofitted |
| Full identity surface (loyalty + membership + ID + access) | Broader than most pure-loyalty competitors |

---

*This document reflects architecture, compliance, and competitive decisions already validated in prior working sessions. It should be treated as the shared reference for engineering, design, and go-to-market as LinearCard moves from prototype to build.*
