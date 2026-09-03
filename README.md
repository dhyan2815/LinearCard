# LinearCard

![LinearCard Architecture](https://img.shields.io/badge/Next.js-16%20(App%20Router)-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase)

**LinearCard** is a premium, end-to-end digital pass generator for Google Wallet (and Apple Wallet). It features a sleek, Linear-inspired dark mode UI, seamless 3D live previews, and enterprise-grade backend infrastructure. 

LinearCard enables brands to issue, manage, and dynamically update digital passes directly via the Google Wallet API using signed JWTs.

---

## ✨ Features

- **Google Wallet Integration:** On-the-fly RS256 JWT creation and official `savetowallet` link generation. No third-party middlemen.
- **Premium Design System:** Linear-inspired aesthetic with global dark/light mode, brand-blue accents, glassmorphism, metallic shine animations, and a responsive 3D card tilt effect.
- **Tenant Isolation:** Multi-tenant architecture with tenant-aware filtering, customizable webhooks, and separate data silos per brand.
- **Consumer Onboarding Flow:** Beautiful mobile-first enrollment, real-time OTP verification, and DPDP consent tracking.
- **Admin Dashboard & CRM:** 
  - Manage live digital pass templates (Loyalty, Membership, ID Card, Access Badge).
  - Modify member points/balances live via the Google Wallet REST API.
  - Complete CRM view with full audit trails and customer consent logs.
- **Notification Deliveries:** Built-in multi-channel marketing campaigns through WhatsApp and Google Wallet Push Notifications.
- **Integrated QR Scanner:** Built-in staff-facing application to scan passes and process redemptions securely.
- **Robust Security:** HTTP-only JWT admin authentication, persistent audit logs, and SHA-256 OTP hashing with rate limits.

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript / Node.js (ES Modules)
- **Styling:** Tailwind CSS v4 (with Semantic Theming)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** `google-auth-library` (Google API), Custom HTTP-only JWTs (Admin).
- **UI Libraries:** `lucide-react`, `qrcode.react`, `canvas-confetti`, `motion` (Framer Motion)

## 🚀 Getting Started

### Prerequisites

- Node.js v18 or later
- Supabase Project (Database)
- Google Cloud Service Account (with Wallet API access)

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
   Ensure you have a `.env` file in the root directory with the necessary Google Cloud credentials, Supabase keys, and JWT secrets.

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open the App:**
   Navigate to `http://localhost:3000` to view the app in your browser.

## 🗂 Project Structure

- `app/` - Next.js App Router endpoints, layouts, and pages (Dashboard, Scanner, Enrollment).
- `components/` - Reusable UI components (PassPreviewCard, ThemeToggle, WalletModal, etc.).
- `docs/` - Product requirement documents, E2E testing guides, and competitor research.
- `lib/` - Core business logic:
  - `google-wallet.ts` - Cryptographic pass generation & API sync.
  - `otp.ts` - Secure SHA-256 OTP generation, validation, and rate limiting.
  - `notify.ts` - Delivery ledger and push notification logic.
  - `whatsapp.ts` - WhatsApp integration for pass distribution.
- `supabase/` - SQL schemas and database setup scripts.
- `tests/` - Standalone API validation scripts (`smoke-test.mjs`, `schema-check.mjs`, etc.).

## 🛡 Security & Compliance

- Rate-limited and SHA-256 hashed OTPs for consumer protection.
- Strict multi-tenant data segregation.
- Persistent audit logs for all point adjustments, pass creations, and administrative actions.
- Admin dashboard protected behind proxy-based HTTP-only JWT verification.

## 📄 License

This project is licensed under the MIT License.
