# LinearCard: AI Context & Project Brain

*Last Updated: 2026-09-02T08:09:01+05:30*

> **Purpose:** This document is designed to give any AI or human developer an immediate, end-to-end understanding of the LinearCard project. It contains the business goals, architecture, tech stack, current status, and operational logic. Read this first before writing any code or proposing architectural changes.

---

## 1. Project Overview
**LinearCard** is a wallet-native loyalty, membership, and digital-identity platform explicitly designed for brands in India and the GCC. It allows businesses (cafes, gyms, events) to issue digital passes that live directly inside **Apple Wallet and Google Wallet**. 

**Core Differentiators:**
- **Zero Apple Developer Friction:** Brands don't need their own developer accounts. LinearCard uses a multi-tenant shared certificate architecture.
- **WhatsApp as a First-Class Channel:** Replaces emails and apps with WhatsApp-based OTP enrollment, pass delivery, and transaction receipts.
- **Compliance-First:** Native adherence to India's DPDP Act and GCC's PDPL through strict, auditable consent captures at the time of enrollment.

---

## 2. Tech Stack & Architecture
- **Framework:** Node.js (ES Modules), Next.js 16 (App Router) with React 19 (Server + Client Components).
- **Database:** PostgreSQL via Supabase. Multi-tenant data model containing `Admin`, `Tenant`, `Member`, `Pass`, and `OtpSession` records. (Note: Prisma and SQLite have been entirely removed).
- **Styling:** Tailwind CSS v4 with a custom dark-mode, glassmorphism, industrial-tech aesthetic (inspired by the Linear app). Semantic color variables (e.g., `bg-canvas`, `bg-surface-card`) handle light/dark theming natively via `ThemeToggle.tsx`.
- **Authentication:** 
  - *Admins:* Phone + OTP login, secured via HTTP-only JWT cookies and guarded by `proxy.ts` (Next.js middleware equivalent).
  - *Customers:* Stateless Phone + OTP enrollment.
- **Wallet Integration:** Official Google Wallet API (`googleapis`, `google-auth-library`). Creates and signs JWT passes (`RS256`), storing pass details in the database and generating short URLs (`/api/p/[id]`) for WhatsApp delivery rather than large JWTs. Uses Android Intent URIs (`intent://`) for deep linking directly to Google Wallet. Tenant images are correctly resolved as absolute URLs for Google Wallet compliance.
- **Messaging:** WAHA (WhatsApp HTTP API) for instant OTP delivery, pass links, and transactional receipts.

---

## 3. Latest Status & Achievements (As of Sept 2026)
- **Phase 5 (Identity & Onboarding) Completed:** The app successfully transitioned from standalone CLI tools into a unified, full-stack Next.js web application.
- **PoC Demo Implementation Completed:** All 5 demo build targets (Admin Login Stability, OTP Error Differentiation, Dashboard Live Counts, Members List Page, Scanner Demo Stability) have been fully validated, achieving the ~72% PRD match ratio target for Demo Day. The primary demo flow (OTP Enroll → WhatsApp Pass Delivery → Staff Scan/Redeem → Admin Members View) is demo-ready.
- **Database Migration Finalized:** Fully migrated to a managed PostgreSQL database via Supabase. The `prisma` directory and SQLite references have been completely removed.
- **Staff Scanner Active:** A real-time, camera-based QR scanner (`/scan`) is fully functional. It parses wallet passes, performs local sub-300ms validations, and redeems points instantly with robust unambiguous rejection UI for invalid or duplicate scans.
- **Fully Themed UI:** Global dark/light modes implemented project-wide, eliminating hardcoded Tailwind classes for a unified design system. Polished dashboard components by reducing heavy shadows for a cleaner aesthetic.
- **Short Links & Image Resolution:** Replaced massive 1,100+ character JWT links with clean short URLs (`/api/p/[id]`) for WhatsApp delivery. Fixed tenant image resolution ensuring absolute URLs for Google Wallet API compliance, alongside local placeholder images.
- **End-to-End Validation:** Edge cases and gaps (route protection, WAHA deep linking, duplicate update prevention) have been rigorously tested and closed per the latest manual testing guides.

---

## 4. Key Personas & User Flows
1. **Brand Admin:**
   - Logs in via OTP at `/login`.
   - Uses `/dashboard` to design visual templates with a live 3D preview, and view live system stats.
   - Pushes `GenericClass` templates to Google Wallet.
   - Issues offline JWT passes to users and pushes live pass updates (tier/balance changes) via the Google Wallet REST API.
   - Views and searches through all enrolled users via `/dashboard/members`.
2. **Frontline Staff:**
   - Uses the `/scan` tablet interface.
   - Scans a customer's pass QR code via device camera.
   - Deducts points locally, which triggers an async push to update the customer's Google Wallet pass and sends a WhatsApp receipt.
3. **End Customer:**
   - Scans a generic QR in-store, opening `/enroll`.
   - Enters their phone number, checks the mandatory DPDP consent box, and inputs an OTP.
   - Taps "Add to Google Wallet" (triggering an Android Intent to natively open Wallet) and receives a backup link on WhatsApp.

---

## 5. Directory Structure & Key Files
- `app/api/`: All backend endpoints.
  - `/admin/*`: OTP generation and verification for admins.
  - `/generate-pass/`, `/create-class/`, `/update-pass/`, `/validate-pass/`: Core wallet logic and issuance.
  - `/dashboard/stats/` & `/members/`: Endpoints for live dashboard metrics and member lists.
- `app/dashboard/`: Admin-facing template designer, manual issuance, live updates, and `members/` list.
- `app/enroll/`: Customer-facing OTP signup and pass claim flow.
- `app/scan/`: Staff-facing QR scanner and redemption interface.
- `lib/`:
  - `google-wallet.ts`: Cryptographic signing and Google API integration.
  - `whatsapp.ts`: WAHA integration for messaging.
  - `db.ts`: Supabase client connection setup.
- `components/`: Reusable UI elements (`PassPreviewCard.tsx`, `WalletModal.tsx`, `ThemeToggle.tsx`).
- `docs/`: Extensive project documentation (`LinearCard_PRD_v1.md`, `LinearCard_User_Flows.md`, `New_Features_Implementation_Plan.md`).
- `GEMINI.md`: Project's persistent memory and changelog. *Always read this to stay updated on architectural shifts.*

---

## 6. Known Next Steps / Roadmap
- **Analytics Polish:** Build out the India vs. GCC comparative analytics dashboard (P1).
- **Talon.One Integration:** Connect a broader promotions/rules engine.
- **Apple & Samsung Wallet:** Scale the integration out beyond Google Wallet (incorporating the multi-tenant Apple shared certificate architecture).
- **Payment-Linked Enrollment:** Prototype UPI/tap-to-pay automatic enrollment patterns.
- **Phase 6 - WhatsApp API Deep Integration:** Real WhatsApp Cloud API integration replacing the WAHA mock/testing setup.

---

## 7. Operational Rules for AI Assistants
- **Style Enforcement:** Always prioritize preserving the high-contrast, Linear-inspired dark UI. Use semantic variables (`text-ink-dark`, `bg-canvas`), not generic Tailwind colors.
- **Backend Safety:** Ensure all new API routes have idempotency guards and duplicate-action protection (reference `update-pass`).
- **Memory Maintenance:** Always append significant architectural changes to `GEMINI.md`.
- **Context Timestamps (MANDATORY):** Whenever updating this `PROJECT_CONTEXT.md` file, you MUST always update the `Last Updated` date and exact time at the very top of the markdown file.
- **References:** Refer to `docs/LinearCard_User_Flows.md` when touching authentication, routing, or the scanner logic to avoid breaking established user flows.
