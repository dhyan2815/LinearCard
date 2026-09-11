# LinearCard

![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-EF4444?style=flat-square&logo=turborepo)
![Next.js](https://img.shields.io/badge/Next.js-16%20(App%20Router)-black?style=flat-square&logo=next.js)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs)
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

### Backend (`apps/api`)
- **Framework:** NestJS 10 (Port `3001`)
- **Modular Architecture:**
  - `AuthModule`: OTP generation, SHA-256 verification, and authentication
  - `DashboardModule`: Tenant dashboard metrics, analytics, and overview data
  - `MembersModule`: CRM member profiles, balances, and pass associations
  - `NotificationsModule`: Multi-channel marketing (WhatsApp & Google Wallet push notifications)
  - `PassesModule`: Pass issuance, live pass updates, and PassTemplate CRUD
  - `TenantModule`: Tenant profiles and webhook management
  - `WalletModule`: Google Wallet REST API integration and cryptographic RS256 JWT signing
- **Database / BaaS:** Supabase (PostgreSQL) for multi-tenant data, templates, and audit logs
- **Google Wallet Integration:** `google-auth-library` to securely interact with the Wallet REST API
- **Cryptography & Security:** `jsonwebtoken` (for JWTs) and native Node.js `crypto` (for SHA-256 OTP hashing)
- **Environment:** `dotenv`

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
     Ensure Google Cloud credentials (`GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_ISSUER_ID`), Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), and `JWT_SECRET` are configured.

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
├── docs/                      # PRDs, architecture briefing, and testing guides
├── turbo.json                 # Turborepo task pipeline configuration
├── package.json               # Root monorepo configuration & scripts
└── README.md
```

## Security & Compliance

- Rate-limited and SHA-256 hashed OTPs for consumer protection.
- Strict multi-tenant data segregation.
- Persistent audit logs for all point adjustments, pass creations, and administrative actions.
- Admin dashboard protected behind proxy-based HTTP-only JWT verification.

## 📄 License

This project is licensed under the MIT License.
