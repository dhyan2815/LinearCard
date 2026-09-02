# LinearCard — Tenant-Scoped Enrollment: Implementation Plan

**Prepared for:** Dhyan Patel
**Scope:** Replacing the generic "The SkyHigh Alliance" hardcode with a real tenant-aware enrollment
architecture, structured so adding future brands requires zero code changes.
**Demo target:** BeanHouse Coffee + IronCore Fitness, local `next dev`

---

## The Problem, Stated Precisely

Right now, `/enroll` is a single generic page. When it calls `/api/send-otp` and then
`/api/verify-otp`, neither route knows which brand the consumer is enrolling into. The pass
gets generated with hardcoded dummy values:

- Brand name: `"The SkyHigh Alliance"` (replace with `"LinearCard Demo Pass"` as fallback)
- Brand color: `#1A365D`
- Class suffix: `"membership_card"`

A consumer scanning a QR code at BeanHouse gets a pass that says none of those things. This
breaks the entire multi-tenant promise of the product.

---

## The Solution: Tenant Slug in the URL Path

Every brand gets one permanent, unique enrollment URL:

```
/enroll/beanhouse_coffee      ← BeanHouse Coffee
/enroll/ironcore_gym          ← IronCore Fitness
/enroll                       ← Fallback: "LinearCard Demo Pass" (internal/test only)
```

The `classSuffix` column already exists on the `tenants` table in the Prisma schema. That
value becomes the URL slug. No new database columns are needed.

---

## What Needs to Change — File by File

### 1. Next.js Route: `app/enroll/page.tsx` → `app/enroll/[slug]/page.tsx`

**What to do:**
Rename the directory from `app/enroll/` to `app/enroll/[slug]/`. Next.js will automatically
treat `[slug]` as a dynamic segment, making `params.slug` available to the page component.

The page must:
1. On load, call a new internal API route `GET /api/tenant/[slug]` to fetch the tenant's
   branding config (name, color, logo, hero image, class suffix).
2. Store the returned tenant config in component state.
3. Render the enrollment UI with the tenant's brand color and program name instead of
   hardcoded values.
4. Pass the `tenantId` (or `classSuffix`) through to the `/api/send-otp` and
   `/api/verify-otp` calls in the request body.
5. If the slug is not found (API returns 404), show a clear error screen: "This enrollment
   link is invalid. Please ask the brand for their correct link." — do not fall through to
   a generic pass.

**The bare `/enroll` route (no slug):**
Keep `app/enroll/page.tsx` as a simple page that renders a message:
"This is an internal LinearCard test enrollment. Pass will be issued under the LinearCard
Demo Pass program." Then it calls `/api/tenant/default` which returns a hardcoded internal
tenant config (name: "LinearCard Demo Pass", color: `#F97316`, classSuffix: `linearcard_demo`).
This fallback is only for internal testing — it is never given to a real brand's customers.

---

### 2. New API Route: `GET /api/tenant/[slug]/route.ts`

**Purpose:** Public, unauthenticated endpoint. Accepts a `classSuffix` slug, returns the
tenant's public branding config. This is safe to expose publicly — it contains no secrets,
only display data.

**Input:** URL param `slug` (e.g., `beanhouse_coffee`)

**Logic:**
```
1. Query: SELECT id, name, brandHexColor, logoUrl, heroUrl, classSuffix
   FROM tenants WHERE classSuffix = slug
2. If not found → 404 { error: "Tenant not found" }
3. If found → 200 { tenantId, name, brandHexColor, logoUrl, heroUrl, classSuffix }
```

**Why this is its own route and not embedded in the page:**
The enrollment page is a client component (it manages form state). It cannot directly query
Prisma. A dedicated API route is the correct Next.js App Router pattern here.

---

### 3. Update: `POST /api/send-otp/route.ts`

**Current input:** `{ phone: string }`
**New input:** `{ phone: string, tenantId: string }`

The `tenantId` must be stored alongside the OTP session so that `/api/verify-otp` can look
up the correct tenant when it issues the pass. Update the `OtpSession` creation to include
`tenantId` in whatever field is available (add a `metadata` JSON column to `otp_sessions`
in the Prisma schema, or add a dedicated `tenantId` String field).

**Prisma schema change:**
```prisma
model OtpSession {
  id          String   @id @default(cuid())
  phone       String
  otpHash     String
  tenantId    String           // ADD THIS
  purpose     String
  expiresAt   DateTime
  consumedAt  DateTime?
  createdAt   DateTime @default(now())
}
```

---

### 4. Update: `POST /api/verify-otp/route.ts`

**Current behavior:** Hardcodes all pass data (brand name, color, classSuffix).
**New behavior:**
1. After validating the OTP, read `tenantId` from the matched `OtpSession` record.
2. Query `tenants` table for that `tenantId` to get `brandHexColor`, `logoUrl`, `heroUrl`,
   `classSuffix`, and `name`.
3. Use those values when calling `createGoogleWalletPass()` — replacing every hardcoded value.
4. Store the created pass record in the `passes` table with the correct `tenantId`.
5. The WhatsApp pass link message should include the brand name: "Your [BeanHouse Coffee]
   loyalty card is ready. Tap to add it to Google Wallet."

**Object ID format (important):** The `genericObject` ID must be namespaced by tenant to
avoid collisions between brands:
```
{ISSUER_ID}.{classSuffix}_{phoneDigits}_{randomHex}
```
Example: `3388000000012345678.beanhouse_coffee_919876543210_a1b2c3`

This ensures two brands can enroll the same phone number without ID collision.

---

### 5. Update: Seed Data (`prisma/seed.ts`)

Ensure the two seeded tenants have their `classSuffix` values matching the URL slugs exactly:

```
BeanHouse Coffee  → classSuffix: "beanhouse_coffee"   → URL: /enroll/beanhouse_coffee
IronCore Fitness  → classSuffix: "ironcore_gym"        → URL: /enroll/ironcore_gym
```

Also seed a third internal tenant for the fallback:
```
LinearCard Demo   → classSuffix: "linearcard_demo"    → URL: /enroll (fallback only)
```

The `linearcard_demo` tenant should never appear in the dashboard's tenant list — it is
purely for internal testing.

---

### 6. Update: `app/enroll/[slug]/layout.tsx`

The enrollment layout shell currently shows a generic "LinearCard" header. Update it to
accept a `brandName` prop (passed from the page after the tenant fetch) and display:
"Powered by LinearCard" in small subtext below the brand name, so the consumer sees their
brand front and center, with LinearCard as the infrastructure beneath it. This is the correct
B2B SaaS framing — LinearCard is invisible to the end consumer's brand experience.

---

### 7. Dashboard — QR Code Generation for Admins

The dashboard should display the tenant's enrollment URL and a QR code for it, so admins
can print or share it. This belongs in the Template Designer tab as a read-only field:

```
Enrollment Link:  https://linearcard.vercel.app/enroll/beanhouse_coffee  [Copy] [Download QR]
```

For the PoC demo (localhost), the link will show `http://localhost:3000/enroll/beanhouse_coffee`.
A `qrcode.react` component can render this inline — the library is already installed.

This does not require a new API route. The dashboard already knows the tenant's `classSuffix`
from the seeded data. The URL is simply constructed on the client:
```
`${window.location.origin}/enroll/${classSuffix}`
```

---

## What Does NOT Change

- `/api/generate-pass` — internal function, called by `verify-otp`. No UI calls it directly
  after the enrollment flow fix. No changes needed.
- `/api/create-class` — the dashboard pushes templates per-tenant. Already uses `classSuffix`
  as input. No changes needed.
- `/api/update-pass` and `/api/validate-pass` — operate on `passId`, not tenant. No changes.
- `/scan` — no tenant context needed. Staff scans any pass from any brand.
- `/login` and `/dashboard` — admin auth is tenant-scoped at the DB level already.
- `lib/google-wallet.ts` — no changes. Already accepts all pass fields as parameters.

---

## The Future-Proofing Guarantee

After this implementation, adding a new brand (e.g., "Karma Yoga Studio") requires exactly
three steps, all of which are data operations — no code changes:

1. Insert a new row into the `tenants` table:
   ```sql
   INSERT INTO tenants (name, classSuffix, brandHexColor, logoUrl, heroUrl)
   VALUES ('Karma Yoga Studio', 'karma_yoga', '#4A90D9', '...', '...');
   ```
2. The brand admin logs into `/login`, scans their OTP, reaches `/dashboard`.
3. They copy their enrollment link: `linearcard.vercel.app/enroll/karma_yoga` and print the QR code.

That's it. The `GET /api/tenant/[slug]` route handles all new slugs automatically because it
queries the database dynamically — it is not a hardcoded lookup.

---

## Execution Order for the PoC (Prioritised)

Since you have less than 2 days:

**Do first (blocks everything else):**
1. Rename `app/enroll/` → `app/enroll/[slug]/` and add the tenant fetch on load.
2. Create `GET /api/tenant/[slug]/route.ts` (20 lines of Prisma query).
3. Add `tenantId` to `OtpSession` schema, run `npx prisma migrate dev`.
4. Update `send-otp` and `verify-otp` to pass and consume `tenantId`.

**Do second (dashboard QR, lower risk):**
5. Add enrollment URL + QR code display to the Template Designer tab.
6. Update the enrollment layout to show brand name.

**Do last (nice to have for demo):**
7. Add the "LinearCard Demo Pass" fallback to bare `/enroll`.
8. Update seed data to include the `linearcard_demo` internal tenant.

---

*This plan resolves both consumer-facing questions: the consumer knows which brand they're
enrolling into because the URL and UI reflect that brand's identity from the first screen.
The routing is managed by the URL slug, which is set once per brand and never changes.*
