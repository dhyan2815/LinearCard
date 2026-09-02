# Demo-Readiness To-Do List

This document tracks all features, changes, and fixes required to ensure the LinearCard Web App is fully demo-ready, technically sound, and aligned with core product requirements.

## 1. Strict Tenant Scoping (Brand Admin Isolation)
*Status: Pending*

**Objective**: Ensure a logged-in Brand Admin can only access and view data for their own specific brand, removing the "Super Admin" multi-tenant dropdown from the dashboard.

- [ ] **Auth Context Binding**: Ensure the admin's login process securely embeds their specific `tenantId` inside their encrypted session cookie or JWT.
- [ ] **Backend API Scoping**:
  - [ ] Replace or modify the `GET /api/tenants` endpoint to act as a `GET /api/tenant/me` route that only returns the single tenant profile associated with the JWT `tenantId`.
  - [ ] Update all operational APIs (e.g., `/api/dashboard/stats`, `/api/generate-pass`, `/api/update-pass`) to extract the `tenantId` strictly from the server-side JWT rather than trusting client-side payload data.
- [ ] **Frontend Dashboard UI Updates (`app/dashboard/page.tsx`)**:
  - [ ] Remove the tenant selection `<select>` dropdown.
  - [ ] Update state management to handle a single `currentTenant` instead of a `tenants` array.
  - [ ] Statically display the logged-in brand's identity (Name, Logo) in the dashboard header to reinforce the isolated environment.

## 2. Consumer Enrollment: Capture Member Name
*Status: Pending*

**Objective**: Enhance the consumer onboarding flow (QR scan -> Claim Pass) by capturing the consumer's Full Name alongside their phone number.

**Why this is the correct approach (Validation)**:
- **Personalized Passes**: Google Wallet passes feel significantly more premium when they display the actual cardholder's name (e.g., "John Doe") rather than a generic placeholder or phone number.
- **Better Admin Experience**: In the brand admin dashboard, seeing a list of real names in the "Session Passes" history is much more actionable and readable than a list of bare phone numbers.
- **Future CRM/Marketing**: Having the name unlocks the ability to send personalized WhatsApp delivery messages ("Hi John, here is your pass!") and builds a better foundational CRM for the brand.

**Implementation Steps**:
- [ ] **Database Schema**: Update the database schema (and Supabase types) for the member/consumer table to include a `name` column.
- [ ] **Enrollment UI (`app/enroll/[slug]/page.tsx`)**: Add a "Full Name" input field to the initial step where the user currently only enters their phone number.
- [ ] **Backend API Updates**: Update the `/api/send-otp` or `/api/verify-otp` (depending on where the user record is created) to accept, validate, and store the `name` in the database.
- [ ] **Pass Generation Pipeline**: Ensure that when the pass is generated post-enrollment, the newly captured `name` is passed into the Google Wallet JWT payload so it renders on the card.

## 3. Protected Route Enforcement (Dashboard Access Control)
*Status: Pending*

**Objective**: Prevent unauthorized access to the admin dashboard and scanner by strictly enforcing route protection and redirecting unauthenticated users to the login flow.

**Context**: Currently, manually typing `/dashboard` in the URL bypasses the mobile login flow and grants immediate access. This is a critical security flaw that will severely impact the credibility of the demo.

**Implementation Steps**:
- [ ] **Next.js Middleware (`middleware.ts`)**: Implement or fix the global middleware to intercept requests to `/dashboard/*` and `/scan/*`.
- [ ] **Auth Verification**: The middleware must check for the presence and validity of the admin's JWT/Session cookie.
- [ ] **Redirection Logic**: If no valid session exists, automatically redirect the user to the admin login page (forcing the mobile number verification flow).
- [ ] **Frontend State Protection**: Ensure the dashboard page itself doesn't crash or flash sensitive data while waiting for the server-side auth check.

## 4. End-to-End Flow Verification
*Status: Pending*

**Objective**: Guarantee that all critical user journeys work flawlessly for the founder demo.

- [ ] Verify Admin Login -> Dashboard load sequence.
- [ ] Verify Template Designer -> Push to Google Wallet workflow.
- [ ] Verify Issue Pass -> QR code generation -> Direct Wallet save on device.
- [ ] Verify Live Updates -> Patching existing pass balances and tiers.
- [ ] Verify Consumer Enrollment with Name + Phone -> WhatsApp OTP -> Pass Generation.
