# LinearCard — PoC Implementation Plan
**Target:** 68–72% PRD match ratio by demo day  
**Audience:** Technical peers + Founder  
**Demo flows:** OTP Enroll → WhatsApp Pass Delivery → Staff Scan/Redeem → Admin Members View  

> **How to use this doc:** Each build item references the exact PRD section (e.g. `PRD §7.3`) and PROJECT_CONTEXT section (e.g. `CTX §3`) it satisfies. Use those references to cross-check acceptance criteria before marking a task done.

---

## Build 1 — Admin Login Flow Stability
**PRD ref:** §7.1 (Dashboard — P0), §5 (Brand Admin persona)  
**CTX ref:** §3 (Latest Status), §4 (Key Personas — Brand Admin)  
**Estimated time:** 1–2 hours  
**Why it matters:** The founder sees this first. A broken login before the demo kills confidence before the product is shown.

### What to build
The login flow (phone OTP → JWT cookie → redirect to `/dashboard`) already exists. This build is about making it demo-stable, not rebuilding it.

### Steps

**1.1 — Verify OTP generation endpoint**
- Hit `POST /api/admin/otp/generate` with a real phone number.
- Confirm WAHA fires a WhatsApp message with the OTP.
- Confirm the `OtpSession` record is written to SQLite via Prisma.
- Reference: `app/api/admin/` (CTX §5), `lib/whatsapp.ts` (CTX §5)

**1.2 — Verify OTP verification + JWT cookie**
- Hit `POST /api/admin/otp/verify` with the correct code.
- Confirm the HTTP-only JWT cookie is set in the response.
- Open DevTools → Application → Cookies and confirm it's present.
- Reference: `proxy.ts` middleware (CTX §2, Auth section)

**1.3 — Verify protected route redirect**
- Clear cookies, hit `/dashboard` directly.
- Confirm `proxy.ts` redirects to `/login` — not a 500 or blank screen.
- Confirm after login, redirect lands correctly back on `/dashboard`.

**1.4 — Edge case: expired OTP**
- Wait for OTP to expire (or manually expire the `OtpSession` record in SQLite).
- Attempt verification — confirm the error message is specific ("OTP expired"), not generic.
- Reference: PRD §7.3 acceptance criteria (distinct error states)

**1.5 — Edge case: wrong OTP code**
- Enter a wrong code — confirm error says "Invalid code", not the same message as expired.
- This is a one-line message change in the verify handler if not already differentiated.

---

## Build 2 — OTP Enrollment Error Differentiation
**PRD ref:** §7.3 (Signup / OTP Flow — P0), acceptance criteria point 3  
**CTX ref:** §4 (Key Personas — End Customer), §5 (`app/enroll/`)  
**Estimated time:** 1 hour  
**Why it matters:** Technical peers will test this on the spot during the demo. A generic "OTP failed" message signals incomplete thinking.

### What to build
The enrollment flow works. This build adds specific error message differentiation at the `/enroll` OTP verification step — no architectural change required.

### Steps

**2.1 — Locate the OTP verify handler for enrollment**
- File: `app/api/...` (whichever route handles customer OTP verify, separate from admin)
- Identify where the error response is returned on failure.

**2.2 — Add error code differentiation**
- Check the `OtpSession` record: if `expiresAt < now` → return `{ error: "OTP has expired. Please request a new code." }`
- If code doesn't match → return `{ error: "Incorrect code. Please try again." }`
- If too many attempts (if rate limiting exists) → return `{ error: "Too many attempts. Please wait before retrying." }`
- Reference: PRD §7.3, acceptance criteria point 3 — "Failed OTP attempts show a clear, specific error (expired code vs. wrong code vs. rate-limited)"

**2.3 — Update the frontend to surface these messages**
- File: `app/enroll/` — wherever the OTP input and submission state live.
- Render the error string from the API response directly under the OTP input field.
- Use a red/destructive color from the existing design system (do not hardcode — use semantic variables per CTX §7 style rules).

**2.4 — Test all three paths**
- Expired code → correct message shown.
- Wrong code → correct message shown.
- Happy path still works end-to-end.

---

## Build 3 — Dashboard Live Counts
**PRD ref:** §7.1 (Dashboard — P0), acceptance criteria points 1 and 3  
**CTX ref:** §3 (Latest Status), §5 (`app/dashboard/`), §5 (`lib/db.ts`)  
**Estimated time:** 2–3 hours  
**Why it matters:** A static dashboard with placeholder numbers reads as unfinished to both the technical peers and the founder. Two real DB-backed numbers change the perception entirely.

### What to build
Add three live data points to the existing dashboard UI: Total Members, Total Passes Issued, and a Google Wallet status badge. No new pages — this is purely wiring existing DB data to the existing dashboard component.

### Steps

**3.1 — Create a dashboard stats API route**
- File: `app/api/dashboard/stats/route.ts` (new file)
- Query via Prisma:
  ```ts
  const memberCount = await prisma.member.count();
  const passCount = await prisma.pass.count();
  ```
- Return: `{ memberCount, passCount, walletStatus: "Google Wallet — Active" }`
- Reference: `lib/db.ts` (CTX §5), Prisma schema (`Member`, `Pass` models — CTX §2)

**3.2 — Fetch stats on dashboard load**
- File: `app/dashboard/page.tsx` (or whichever is the dashboard server component)
- Since this is Next.js App Router with Server Components (CTX §2), fetch directly in the server component — no `useEffect` needed:
  ```ts
  const stats = await prisma.member.count(); // inline, or call the route
  ```
- Pass counts as props to the dashboard client component.

**3.3 — Render the three stat cards**
- Add to the existing dashboard layout:
  - "Total Members" → `memberCount` (live)
  - "Passes Issued" → `passCount` (live)  
  - "Google Wallet" → green status badge ("Active")
- Use existing card/glassmorphism component patterns (CTX §2 — Tailwind, semantic variables). Do not introduce new Tailwind color classes — use `bg-surface-card`, `text-ink-dark` etc. per CTX §7.

**3.4 — Verify counts update after enrollment**
- Run an enrollment end-to-end.
- Refresh the dashboard.
- Confirm `memberCount` and `passCount` both incremented.

---

## Build 4 — Members List Page
**PRD ref:** §7.4 (Members / CRM — P0), acceptance criteria point 1  
**CTX ref:** §4 (Key Personas — Brand Admin), §5 (`app/dashboard/`)  
**Estimated time:** 3–4 hours  
**Why it matters:** This is the "here are your customers" moment for the founder. It closes the loop between the enrollment flow and the admin view — showing that the system actually captured the member.

### What to build
A read-only `/members` page (or `/dashboard/members`) showing a searchable table of enrolled members. No segmentation, no audit trail yet — those are Phase 2 (PRD §12, Phase 2 scope).

### Steps

**4.1 — Create the members API route**
- File: `app/api/members/route.ts` (new file)
- Query:
  ```ts
  const members = await prisma.member.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      phone: true,
      createdAt: true,
      passes: { select: { id: true, status: true } }
    }
  });
  ```
- Return the array as JSON.
- Add idempotency guard: this is a GET, so no mutation guard needed, but ensure the route is behind admin auth middleware (proxy.ts — CTX §2).

**4.2 — Create the members page**
- File: `app/dashboard/members/page.tsx` (new file)
- Fetch members server-side (Server Component, App Router — CTX §2).
- Render a table with columns: Phone Number, Enrolled Date, Pass Status, Pass Count.
- Format phone as E.164 (already stored that way per PRD §7.3 and CTX §2).
- Format `createdAt` as a readable date string.

**4.3 — Add basic client-side search**
- Make the page a Client Component (or add a child client component for the search input).
- Filter the member list on `phone` field against the search input string.
- This is local filtering — no new API call needed for PoC.

**4.4 — Add nav link to Members from Dashboard**
- Add a sidebar or top-nav link pointing to `/dashboard/members`.
- Use the existing nav component pattern (CTX §5, `components/` — check if a sidebar component exists).

**4.5 — Style to match design system**
- Table rows: `bg-surface-card`, borders using existing border variables.
- Status badge: green for active, muted for inactive — use semantic variables only (CTX §7).
- Do not introduce new Tailwind utility colors.

**4.6 — Verify end-to-end**
- Enroll a new member via `/enroll`.
- Navigate to `/dashboard/members`.
- Confirm the new member appears at the top with correct phone and status.

---

## Build 5 — Scanner Demo Stability
**PRD ref:** §7.6 (Scan / Redeem — P0), all three acceptance criteria  
**CTX ref:** §3 (Staff Scanner Active), §4 (Key Personas — Frontline Staff), §5 (`app/scan/`)  
**Estimated time:** 1–2 hours  
**Why it matters:** The scanner is already built and is the most technically impressive live demo moment. The only risk is it breaking on a real device during the demo.

### What to build
No new features. This build is clean run-through, edge case hardening, and making sure rejection states are unambiguous.

### Steps

**5.1 — Test on a real Android device (not localhost)**
- Open `/scan` on the device you'll use in the demo.
- Confirm camera permission prompt fires correctly.
- Confirm QR scan parses the pass JWT correctly.
- Reference: CTX §3 — "sub-300ms validations" — confirm this holds on the demo device, not just your dev machine.

**5.2 — Test the happy path end-to-end**
- Enroll a member → get their pass → scan it at `/scan`.
- Confirm: pass info displayed (name/phone/points), points deducted, WhatsApp receipt fires.
- Reference: PRD §7.6 acceptance criteria 1 and 2.

**5.3 — Test rejection states**
- Scan an already-redeemed pass (or manually set a pass to redeemed in SQLite).
- Confirm the UI shows an unambiguous red rejection — not a crash, not silence.
- Reference: PRD §7.6 acceptance criteria 3 — "Invalid/expired/already-redeemed passes show an unambiguous rejection state."
- If the rejection state is ambiguous or missing: add a clear `ALREADY REDEEMED` / `INVALID PASS` error banner to the scan result component.

**5.4 — Test WhatsApp receipt**
- Confirm the receipt message fires to the correct phone number after redemption.
- Confirm the message content makes sense (points balance, brand name, timestamp).
- Reference: `lib/whatsapp.ts` (CTX §5)

**5.5 — Check duplicate redemption guard**
- Scan the same pass twice in quick succession.
- Confirm the second scan is rejected (idempotency guard on `update-pass` — CTX §7, Backend Safety rule).
- Reference: PRD §8 — "Idempotency keys required on all mutating endpoints."

---

## Demo Script (Run in This Order)

This is the sequence to present to both the technical peers and the founder.

```
1. Admin logs in at /login via phone OTP
   → PRD §7.1, §7.3 | CTX §4 (Brand Admin persona)

2. Admin views Dashboard — live member count visible
   → PRD §7.1 | CTX §3

3. Admin opens Template Builder — shows live pass preview
   → PRD §7.2 | CTX §4

4. Customer opens /enroll on their phone
   → enters phone number → OTP arrives on WhatsApp
   → checks DPDP consent box → verifies OTP
   → taps "Add to Google Wallet" → pass appears in Wallet
   → PRD §7.3, §7.8 | CTX §4 (End Customer)

5. Staff opens /scan on tablet
   → scans the customer's pass QR
   → points deducted → WhatsApp receipt fires
   → PRD §7.6 | CTX §4 (Frontline Staff)

6. Admin navigates to /dashboard/members
   → new member visible at top of list
   → PRD §7.4 | CTX §4 (Brand Admin)
```

---

## Final Validation Checklist

Use this before the demo. Every item must be ✅ before you present.

### Build 1 — Admin Login
- [ ] `POST /api/admin/otp/generate` fires a real WhatsApp OTP
- [ ] `POST /api/admin/otp/verify` sets an HTTP-only JWT cookie on success
- [ ] Hitting `/dashboard` without a cookie redirects to `/login`
- [ ] After login, redirect lands on `/dashboard` without errors
- [ ] Expired OTP shows "OTP expired" message (not generic error)
- [ ] Wrong OTP shows "Invalid code" message (different from expired message)

### Build 2 — Enrollment OTP Error States
- [ ] Expired code → "OTP has expired. Please request a new code."
- [ ] Wrong code → "Incorrect code. Please try again."
- [ ] Error messages render under the OTP input field in red/destructive color
- [ ] Happy path enrollment still completes without errors after these changes

### Build 3 — Dashboard Live Counts
- [ ] `GET /api/dashboard/stats` returns real counts from the DB
- [ ] Dashboard shows "Total Members" as a live number
- [ ] Dashboard shows "Passes Issued" as a live number
- [ ] Dashboard shows "Google Wallet — Active" status badge
- [ ] Counts increment after a new enrollment (refresh to verify)
- [ ] Semantic color variables used — no hardcoded Tailwind colors added

### Build 4 — Members List
- [ ] `/dashboard/members` page loads without errors
- [ ] Table shows: Phone Number, Enrolled Date, Pass Status, Pass Count
- [ ] Search input filters members by phone number
- [ ] New enrollees appear at the top (sorted by `createdAt desc`)
- [ ] Nav link to Members exists from the main dashboard
- [ ] Page is behind admin auth — unauthenticated access redirects to `/login`
- [ ] Styling matches design system (semantic variables only)

### Build 5 — Scanner Stability
- [ ] `/scan` opens and camera permission fires on real Android device
- [ ] QR scan parses a valid pass correctly
- [ ] Happy path: points deducted, pass updated, WhatsApp receipt fires
- [ ] Already-redeemed pass shows unambiguous red rejection UI
- [ ] Invalid/malformed QR shows unambiguous rejection UI
- [ ] Scanning same pass twice in quick succession — second scan is rejected
- [ ] Sub-300ms validation confirmed on the demo device

### Demo Run-Through
- [ ] Full demo script run end-to-end at least once before presenting
- [ ] Tested on the actual device(s) being used in the demo (not just localhost)
- [ ] WhatsApp messages confirmed arriving on a real phone during the dry run
- [ ] Google Wallet pass confirmed opening correctly on Android

---

*PRD references point to `LinearCard_PRD_v1.md`. CTX references point to `PROJECT_CONTEXT.md`. All acceptance criteria traced back to PRD §7.x and §8.*
