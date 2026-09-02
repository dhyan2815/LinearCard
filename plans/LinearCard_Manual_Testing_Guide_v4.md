# LinearCard PoC — Manual Testing Guide (v4)

**Date:** 2026-09-01
**Replaces:** LinearCard_Manual_Testing_Guide_v3.md
**Changes from v3:**
- **Database tooling switched from Prisma Studio to Supabase.** The project has fully migrated
  from SQLite/Prisma to managed PostgreSQL via Supabase. All "open Prisma Studio" steps now
  point to the Supabase Table Editor / SQL Editor instead. Table and column names are
  unchanged (`Tenant`, `OtpSession`, `tenantId`, `classSuffix`, etc.) — only the tool changed.
- **Flow 7 pass ID section rewritten around the short-link format.** Passes are no longer
  identified by a raw 1,100+ character JWT. The barcode/QR now encodes a short URL
  (`/api/p/{id}`) which the scanner resolves server-side. This replaces v3's
  `{ISSUER_ID}.tenant_phone_hex` format guidance, which is obsolete.
- **New Flow 9 — Admin OTP Error Differentiation.** Tests the distinct "expired" vs "invalid"
  OTP messages on both the admin and customer paths (previously generic in v3).
- **New Flow 10 — Dashboard Live Counts.** Tests the three live DB-backed stats (Total
  Members, Passes Issued, Google Wallet Active badge) that replaced the static dashboard.
- **New Flow 11 — Members List (`/dashboard/members`).** Tests the new searchable,
  read-only members list page.
- Flow 7 (Staff Scanner) re-scoped to reflect the dark-mode rebuild and explicit rejection
  states (invalid pass, already-redeemed pass) called out in PROJECT_CONTEXT §3.
- Demo Readiness Verdict and Known Gaps sections updated to include the three new flows.
- All flows cross-referenced against `PROJECT_CONTEXT.md` (2026-09-01) and
  `LinearCard_Session_Compact.md`.

---

## Setup Checklist

Before testing any flow, confirm every item below is true. If any item fails, stop and fix
it before proceeding — testing on a broken setup will give you false negatives.

**1. Dev server is running.**
Run `npm run dev` in the project root. You should see `Local: http://localhost:3000`.
Open `http://localhost:3000` — the LinearCard landing page should load with the hero
headline, orange "Enroll Now" button, "Developer Login →" link, and "Staff Scanner →" link.

**2. Database is seeded correctly (Supabase).**
Open your Supabase project dashboard → **Table Editor**. Check the **Tenant** table for
exactly these rows:

| name | classSuffix | brandHexColor |
|---|---|---|
| BeanHouse Coffee | beanhouse_coffee | #8B4513 |
| IronCore Fitness | ironcore_gym | #FF4500 |
| LinearCard Demo | linearcard_demo | #F97316 |

If any row is missing, run your seed script (check `package.json` for a `db:seed` or similar
script — this replaces the old `npx prisma db seed` command now that the project is off
Prisma migrations for schema management) and re-check in the Table Editor.

Also check the **OtpSession** table has a `tenantId` column. You can confirm this quickly
via the Supabase **SQL Editor** with:
```sql
select column_name from information_schema.columns
where table_name = 'OtpSession' and column_name = 'tenantId';
```
If this returns no rows, the `tenantId` migration hasn't been applied to the Supabase
database yet — apply it before testing.

**3. WAHA WhatsApp session is authenticated.**
Open your WAHA dashboard (the URL in your `WAHA_BASE_URL` env var). The session matching
your `WAHA_SESSION` value must show **Connected** or **Authenticated** status. If it shows
Disconnected or QR Required, re-scan the QR code from the WAHA dashboard now.
Do not assume a session that was working yesterday is still working today — always verify.

**4. Environment variables are present.**
Open `http://localhost:3000/api/generate-pass` in a browser tab (it responds to GET).
You should see a JSON response with:
- `hasIssuerId: true`
- `hasClientEmail: true`
- `hasPrivateKey: true`

If any of those are `false`, the corresponding `.env` key is missing. The required keys are:
`ISSUER_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `WAHA_BASE_URL`, `WAHA_SESSION`,
plus your Supabase connection variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY` / service key).

**5. Two test phone numbers available.**
You need two real phone numbers for the demo:
- **Consumer phone:** the number that will enroll as a member and receive the pass.
- **Admin phone:** the number that will log into `/login` and access `/dashboard`.
These can be the same number, but using two separate phones makes the demo cleaner.

---

## Flow 1 — Pre-flight Checks

**1.1. Landing page loads correctly.**
- Navigate to `http://localhost:3000`.
- Expected: Dark-mode landing page with "Enroll Now" button, "Developer Login →", "Staff Scanner →".
- PASS: All three links are present and clickable.
- FAIL: Blank screen or Next.js error overlay. Fix: check the terminal for a compile error.

**1.2. Tenant API is responding.**
- Navigate to `http://localhost:3000/api/tenant/beanhouse_coffee`.
- Expected: JSON response containing `name: "BeanHouse Coffee"`, `brandHexColor: "#8B4513"`,
  `classSuffix: "beanhouse_coffee"`.
- PASS: Correct tenant data returned.
- FAIL: `{ error: "Tenant not found" }` — the seed data is missing or the slug doesn't match.
  Fix: verify the `classSuffix` in the Supabase Table Editor matches `beanhouse_coffee`
  exactly (case-sensitive).

**1.3. Database has seeded tenants.**
- Open Supabase → Table Editor → `Tenant` table.
- Expected: Three rows as listed in the Setup Checklist.
- PASS: All three rows present with correct values.
- FAIL: Table empty or wrong values. Fix: re-run the seed script.

**1.4. WAHA is live.**
- Open your WAHA dashboard URL.
- Expected: Session shows Connected / Authenticated status.
- PASS: Green/connected status.
- FAIL: Disconnected. Fix: re-scan the WhatsApp QR from the WAHA dashboard.

**1.5. Google Wallet env vars are set.**
- Open `http://localhost:3000/api/generate-pass`.
- Expected: `hasIssuerId: true`, `hasClientEmail: true`, `hasPrivateKey: true`.
- PASS: All three true.
- FAIL: Any false. Fix: check `.env` file.

---

## Flow 2 — Consumer Enrollment via Tenant-Scoped URL (BeanHouse Coffee)

This is the primary demo flow. It must work end-to-end before anything else matters.
The URL the consumer uses is `/enroll/beanhouse_coffee` — not the generic `/enroll`.

**2.1. Open the BeanHouse enrollment page.**
- Navigate to `http://localhost:3000/enroll/beanhouse_coffee`.
- Expected: The enrollment page loads showing BeanHouse Coffee's branding — the brand
  color (`#8B4513`, a warm brown) should be visible in the header or card accent. The page
  title or program name should read "BeanHouse Coffee" (or the configured program name),
  not "LinearCard Demo Pass" or "The SkyHigh Alliance."
- PASS: BeanHouse branding is visible and the form shows phone input + DPDP checkbox.
- FAIL: Page shows generic/wrong brand name, or shows an error. Check that `GET /api/tenant/beanhouse_coffee`
  is returning correctly (Flow 1.2).

**2.2. Verify the page with an invalid slug.**
- Navigate to `http://localhost:3000/enroll/nonexistent_brand`.
- Expected: An error screen — "This enrollment link is invalid. Please ask the brand for
  their correct link." The form should NOT appear.
- PASS: Error screen shown, no enrollment form.
- FAIL: Generic pass form appears with fallback branding. This would mean invalid slugs
  silently fall through to the demo brand — a logic error to fix before the demo.

**2.3. Enter the consumer phone number.**
- On `/enroll/beanhouse_coffee`, select country code `+91` (India) and enter the consumer
  phone number (digits only, e.g. `9876543210`).
- Check the DPDP consent checkbox.
- Expected: "Send OTP" button becomes enabled after both fields are filled.
- PASS: Button is enabled and shows "Send OTP."
- FAIL: Button remains disabled. Check checkbox state logic.

**2.4. Send the OTP.**
- Click "Send OTP."
- Expected: The button shows a loading state. The page transitions to the OTP input screen.
  Within 10 seconds, a WhatsApp message arrives on the consumer phone with a 4-digit code.
  The message should reference "BeanHouse Coffee" — not a generic brand name.
- PASS: WhatsApp message arrives with the correct brand name and a 4-digit OTP.
- FAIL (no message): WAHA session expired. Re-authenticate and retry.
- FAIL (wrong brand name): The `send-otp` route is not passing `tenantId` to the WhatsApp
  message template in `lib/whatsapp.ts`. Check the `sendOtp()` call.

**2.5. Enter the OTP.**
- Type the 4-digit OTP from WhatsApp into the OTP input field.
- Click "Verify & Get Pass" (or equivalent button label).
- Expected: Loading state while the API processes. On success, the page transitions to the
  success screen showing:
  - "Add to Google Wallet" button or link
  - A QR code for the wallet URL
  - The pass is branded as BeanHouse Coffee (correct color, correct program name)
- PASS: Success screen appears with BeanHouse branding and a wallet link.
- FAIL: "Invalid or expired OTP" error. Check that the OTP from WhatsApp was entered exactly.
  See Flow 9 for the differentiated error messages now expected here.
- FAIL: Pass generates but shows wrong brand. Check that `verify-otp` reads tenant config
  from the DB using `tenantId` from the `OtpSession` record.

**2.6. Verify the pass object ID is tenant-namespaced.**
- Open DevTools → Network tab → find the response from `POST /api/verify-otp`.
- Look at the `passId` field in the response JSON.
- Expected format: `{ISSUER_ID}.beanhouse_coffee_{phoneDigits}_{randomHex}`
  e.g. `3388000000012345678.beanhouse_coffee_919876543210_a1b2c3`
- PASS: `classSuffix` of the tenant appears in the pass ID.
- FAIL: Pass ID doesn't include tenant slug — IDs from different brands could collide.
  Note this down. **[VERIFY IN CODE]** — check the object suffix construction in `verify-otp`.

**2.7. Save the pass to Google Wallet (Android device).**
- Copy the wallet URL from the success screen, or tap "Add to Google Wallet."
- On an Android device: the Intent URI should trigger Google Wallet to open natively.
- If testing from a desktop browser: the standard `https://pay.google.com/...` URL should
  open the Google Pay web experience.
- Expected: Google Wallet opens and shows the BeanHouse Coffee pass with correct branding
  (color, program name). Tap "Add to Wallet."
- PASS: Pass appears in Google Wallet with BeanHouse Coffee branding.
- FAIL (Intent URI doesn't open Wallet): Test the Intent URI format in the browser address
  bar on the Android device directly. The format must be:
  `intent://pay.google.com/gp/v/save/{JWT}#Intent;scheme=https;package=com.google.android.apps.walletnfcrel;end`
- FAIL (wrong branding on pass): The pass template is using the wrong `classId`. Check that
  `classSuffix` passed to `createGoogleWalletPass()` is `beanhouse_coffee`, not `membership_card`
  or `linearcard_demo`.

**2.8. Note down the pass short-link ID.**
- On the success screen, the QR code and WhatsApp delivery link now use the short-link
  format `http://localhost:3000/api/p/{id}` rather than the raw JWT used in earlier builds.
- Note down: the `{id}` portion of the short link from the DevTools network response (you
  need this for Flow 7's scanner test).
- PASS: You have the short-link ID noted.
- FAIL: The success screen or WhatsApp message still shows a raw, very long JWT-style URL
  instead of the short link. Check `lib/google-wallet.ts` / the `/api/p/[id]` route for
  regressions — the short-link system should be in place per PROJECT_CONTEXT §3.

**2.9. Repeat for IronCore Fitness (spot check).**
- Navigate to `http://localhost:3000/enroll/ironcore_gym`.
- Expected: IronCore Fitness branding (`#FF4500`, orange-red). Different from BeanHouse.
- Complete the enrollment with a different phone number.
- PASS: Two passes now exist in Google Wallet — one per tenant — with visually distinct branding.
- FAIL: Both passes look identical. The tenant-scoped pass generation is not working.

---

## Flow 3 — Admin Login and Dashboard Access

**3.1. Open the admin login page.**
- Navigate to `http://localhost:3000/login`.
- Expected: Phone number input, "Send OTP" button, LinearCard branding (not tenant-branded —
  the admin login is platform-level, not brand-specific).
- PASS: Login form renders.
- FAIL: Blank page or redirect. Check terminal.

**3.2. Confirm /dashboard is protected.**
- Open a new Incognito window. Navigate directly to `http://localhost:3000/dashboard`.
- Expected: Redirected to `/login`.
- PASS: Redirect happens immediately.
- FAIL: Dashboard loads without any auth. The middleware is not working.
  Fix: check `proxy.ts` (the Next.js middleware equivalent referenced in PROJECT_CONTEXT §2)
  for the `/dashboard` matcher pattern.

**3.3. Confirm /scan is protected.**
- In the same Incognito window, navigate to `http://localhost:3000/scan`.
- Expected: Redirected to `/login`.
- PASS: Redirect happens.
- FAIL: Scan page loads without auth.

**3.4. Log in as admin.**
- On `/login`, enter the admin phone number (the seeded admin number — check the Supabase
  Table Editor → `Admin` table to see what's seeded).
- Click "Send OTP."
- Expected: WhatsApp OTP arrives on the admin phone.
- PASS: OTP message arrives.
- FAIL: No message. Same WAHA debug path as Flow 2.4.

**3.5. Complete admin OTP verification.**
- Enter the 4-digit OTP from WhatsApp.
- Click verify.
- Expected: Redirect to `/dashboard`. The dashboard loads showing the correct tenant's
  branding and data (BeanHouse Coffee or IronCore Fitness depending on which tenant the
  admin is seeded under).
- PASS: Dashboard loads with correct tenant context.
- FAIL: "Invalid or expired OTP." Check OTP entry — see Flow 9 for expected differentiated
  messaging.
- FAIL: Dashboard loads but shows wrong tenant data. Check admin's `tenantId` in the
  Supabase Table Editor.

**3.6. Verify the session cookie was set.**
- In DevTools → Application → Cookies → `http://localhost:3000`.
- Look for a cookie named `session` or `token` (check your `verify-otp` route for the
  exact cookie name used in `res.cookies.set()`).
- Expected: An `httpOnly` cookie is present. You cannot read its value from JS (that's the
  point of httpOnly), but you can see it exists in the Application tab.
- PASS: Cookie is listed as httpOnly.
- FAIL: No cookie present, or cookie is not httpOnly. Check the `Set-Cookie` header in the
  DevTools Network tab for the `/api/admin/verify-otp` response.

**3.7. Verify session persists on refresh.**
- Refresh the `/dashboard` page.
- Expected: Dashboard reloads and stays on `/dashboard` — does not redirect to login.
- PASS: Stays on dashboard.
- FAIL: Redirected to login on refresh. The cookie is not being read by middleware correctly.

---

## Flow 4 — Dashboard: Template Designer Tab

**4.1. Open the Template Designer tab.**
- On `/dashboard`, click the "Template" or "Design Template" tab.
- Expected: Form fields for brand color, program title, logo URL, hero image URL, class suffix.
  The `PassPreviewCard` on the right updates live as you change values.
- PASS: Form and live preview render correctly.

**4.2. Verify the enrollment link and QR code are shown.**
- On the Template Designer tab, look for a read-only "Enrollment Link" field showing:
  `http://localhost:3000/enroll/{classSuffix}` where `{classSuffix}` is the current
  tenant's class suffix.
- A QR code should be rendered below or beside it, encoding the same URL.
- PASS: Enrollment link and QR code are visible and correct.
- FAIL: Neither is shown. **[VERIFY IN CODE]** — check if `qrcode.react` is rendered in the
  Template tab with the enrollment URL. If not, this is still a pending implementation item.

**4.3. Push the template to Google Wallet.**
- Fill in or confirm the form values (color, logo URL, hero URL, class suffix matching the
  tenant's `classSuffix`). Click "Push Template" or equivalent.
- Open DevTools → Network tab. Look for `POST /api/create-class`.
- Expected: The request fires and returns a 200 response. No error in the terminal.
- PASS: 200 response, no terminal error.
- FAIL: 4xx or 5xx response. Check the terminal for the full error from Google's API.
  Common cause: `classSuffix` doesn't match what Google has on file, or credentials are wrong.

**4.4. Confirm `reviewStatus` is not hardcoded to `UNDER_REVIEW`.**
- In the DevTools Network tab, inspect the request payload of `POST /api/create-class`.
- Look at the `reviewStatus` field in the JSON body.
- Expected: Either absent, or set to a valid non-hardcoded value.
- PASS: Field is absent or correct.
- FAIL: `"reviewStatus": "UNDER_REVIEW"` is hardcoded. Note this — it affects pass display
  in some Google Wallet configurations.

---

## Flow 5 — Dashboard: Manage Live Tab (Balance Update)

Note: The "Issue Passes" dashboard tab is NOT part of this test guide. Consumer enrollment
happens via `/enroll/[slug]`, not through the dashboard manually. The Manage Live tab is
for updating a pass that was already issued through enrollment.

**5.1. Select a pass from session history.**
- On `/dashboard`, the right panel shows "Session Passes" — passes generated since the
  dashboard was last loaded. If the list is empty (because enrollment happened before this
  dashboard session), enter the full `passId` manually in the "Pass ID" field on the
  Manage Live tab, or find it via the new Members List (Flow 11).
- PASS: Pass ID is populated in the form.

**5.2. Update the balance.**
- Enter a new balance value (e.g., `250`). Enter the customer's phone number. Click "Update."
- Expected: `POST /api/update-pass` fires. The balance updates in the DB and a Google Wallet
  PATCH is triggered asynchronously. A WhatsApp receipt fires to the customer's phone.
- PASS: Success response from the API, Google Wallet balance updates on device (allow 5–30s),
  WhatsApp receipt arrives.
- FAIL: Error response. Check terminal — common cause is the `passId` not matching a record
  in the DB or Google's API.

**5.3. Verify the WhatsApp receipt message.**
- Check WhatsApp on the consumer phone.
- Expected: A receipt message stating the transaction and new balance, mentioning the
  brand name (e.g., "Your BeanHouse Coffee balance has been updated to 250 points.").
- PASS: Message arrives with correct brand and balance.
- FAIL: No message. Check WAHA status and that the phone number in the form matches the
  enrolled consumer's number exactly (E.164 format, e.g. `+919876543210`).

---

## Flow 6 — IAB Breakout (WhatsApp → Google Wallet)

This flow is Tier A in the Demo PoC Plan. It has been claimed as complete in the Execution
Guide. It must actually work on a real Android device before the demo.

**6.1. Send the enrollment link via WhatsApp.**
- Use any WhatsApp chat to send `http://localhost:3000/enroll/beanhouse_coffee` to yourself.
  (Or use the wallet save short-link from Flow 2 directly.)
- On the Android device, tap the link inside WhatsApp.
- Expected: WhatsApp opens its in-app browser. The enrollment page (or save URL) loads.

**6.2. Tap "Add to Google Wallet" from inside WhatsApp IAB.**
- On the success screen (after completing enrollment inside the WhatsApp browser), tap the
  "Add to Google Wallet" button.
- Expected: The Android system intercepts the `intent://` URI and launches the native
  Google Wallet app directly — WhatsApp's WebView is bypassed entirely. Google Wallet
  opens and shows the pass to be saved.
- PASS: Google Wallet app opens natively from inside a WhatsApp chat.
- FAIL: The link opens a Google webpage inside WhatsApp's WebView, or nothing happens.
  Check that the button href uses the Intent URI format:
  `intent://pay.google.com/gp/v/save/{JWT}#Intent;scheme=https;package=com.google.android.apps.walletnfcrel;end`
  and that it is gated on Android user-agent detection (desktop and iOS should get the
  plain `https://` URL instead).

**6.3. Verify graceful degradation on desktop.**
- On a desktop Chrome browser, complete the enrollment and reach the success screen.
- Expected: "Add to Google Wallet" uses the standard `https://pay.google.com/...` URL,
  not the `intent://` URI (which would be a dead link on desktop).
- PASS: Clicking on desktop opens Google Pay's web interface (or prompts to sign in).
- FAIL: `intent://` is used on desktop — the link does nothing or shows an error.

---

## Flow 7 — Staff Scanner (/scan)

**7.1. Confirm /scan requires auth.**
- Open Incognito → navigate to `http://localhost:3000/scan`.
- Expected: Redirect to `/login`.
- PASS: Redirected.

**7.2. Log in as admin and open /scan.**
- Log in via `/login` (completing the real OTP flow from Flow 3).
- Navigate to `http://localhost:3000/scan`.
- Expected: Dark-mode scanner page (consistent with the rest of the app, per the "Staff
  Scanner Active" and dark-mode rebuild noted in PROJECT_CONTEXT §3). Camera viewfinder or
  camera activation button should be present.
- PASS: Dark-mode scan page with camera scanner component.
- FAIL: Light-mode page — the dark mode fix has regressed.
- FAIL: No camera scanner — only a text input. **[VERIFY IN CODE]** — check if
  `@zxing/library` or `html5-qrcode` is integrated in `app/scan/page.tsx`.

**7.3. Scan the consumer's pass QR code.**
- Have the Android device showing the Google Wallet pass from Flow 2 open.
- On the scan page, activate the camera and point it at the QR code on the pass.
- Expected: The pass short-link ID is read from the QR code and automatically entered. The
  app calls `POST /api/validate-pass` and returns the member's details.

  **Important — pass ID format (updated for short links):** The barcode value encoded
  during enrollment now points to the short-link route `http://localhost:3000/api/p/{id}`
  (see PROJECT_CONTEXT §3, "Short Links & Image Resolution") — not a raw JWT and not the
  legacy `{ISSUER_ID}.tenant_phone_hex` composite string from earlier builds. The scanner
  must extract the `{id}` segment from the scanned URL and pass that to `validate-pass`,
  which should look it up against the `Pass` table in Supabase. **[VERIFY IN CODE]** —
  confirm the scanner correctly parses the short-link `{id}` out of the full URL (rather
  than trying to match the whole URL string), and that `validate-pass` queries on that same
  `{id}` field. If there's a mismatch, paste the `{id}` value noted in Flow 2.8 into the
  manual input field as a fallback.

- Expected member details shown: Name, current balance, tier/status (sourced from the
  Supabase DB directly, not Google's API — this should be fast, under 300ms).
- PASS: Member details appear correctly.
- FAIL: "Pass not found." The `{id}` in the QR doesn't match what's in the `Pass` table.
  This is the most likely failure point — cross-check the `id` column in Supabase Table
  Editor → `Pass` table against what the scanner reads. Confirm the seed/generation step
  writes to the same `id` field the short-link route reads from.

**7.4. Redeem points.**
- The current balance from enrollment is likely `0`. If so, first add points via Flow 5
  (Manage Live tab) before testing redemption here.
- Enter a redemption amount (e.g., `50` points). Click "Redeem."
- Expected: Success message. Balance updates in the UI. Google Wallet pass updates on device
  within 5–30 seconds. WhatsApp receipt fires to the consumer's phone.
- PASS: All three (UI, wallet, WhatsApp) reflect the deduction.
- FAIL: "Insufficient points balance." Add points first via the dashboard Manage tab.

**7.5. Test the duplicate submission guard.**
- Immediately after a successful redemption, click "Redeem" again without changing the amount.
- Expected: Either the button is disabled after the first success, or the second submission
  returns a skipped/blocked response without deducting points a second time.
- PASS: No double-deduction occurs (verify in Supabase Table Editor → `Pass` table that
  balance only decreased once).
- FAIL: Points deducted twice. The guard is not working.

**7.6. Scan an invalid pass (rejection state).**
- On the scan page, manually enter or scan a fabricated/nonexistent short-link `{id}`.
- Expected: An unambiguous rejection UI — clearly styled as an error (not just a blank
  or generic message) stating the pass is invalid or not found.
- PASS: Distinct, unmistakable rejection state shown — a staff member with no context
  should immediately understand the scan failed.
- FAIL: Ambiguous state — no clear pass/fail signal, or the UI silently does nothing.

**7.7. Scan an already-redeemed pass (rejection state).**
- Immediately after successfully redeeming points on a pass (Flow 7.4), scan or enter that
  same pass `{id}` again as a fresh scan (not the "click Redeem again" case in 7.5 — this
  is a new scan attempt on an already-processed pass, e.g. simulating a second staff
  member scanning the same customer).
- Expected: The scanner clearly indicates the pass was already processed / is valid but has
  a current balance reflecting the prior redemption — not a false "not found" or crash.
- PASS: Clear, correct state shown reflecting the pass's real current status.
- FAIL: Crash, blank screen, or a misleading "pass not found" error.

---

## Flow 8 — Edge Cases and Failure States

**8.1. Wrong OTP during enrollment.**
- Start enrollment at `/enroll/beanhouse_coffee`. Enter phone, receive OTP. On the OTP
  screen, type a deliberately wrong 4-digit code (e.g., `0000` when the real OTP is different).
- Expected: Error message specifically indicating an **invalid** code (see Flow 9.1 for the
  exact expected copy). Flow does not proceed to pass generation.
- PASS: Error shown, flow blocked.
- FAIL: Pass generates anyway — OTP validation is bypassed.

**8.2. Expired OTP.**
- Start enrollment, receive OTP, wait 5 minutes (the TTL set in `send-otp`), then enter
  the correct OTP.
- Expected: Error message specifically indicating an **expired** code (see Flow 9.1) — not
  the same generic copy used for a wrong code.
- PASS: Distinct "expired" error shown after TTL.
- FAIL: Expired OTP still works, or shows the same generic message as a wrong OTP.
  Shortcut: open Supabase Table Editor → `OtpSession` table, manually set the `expiresAt`
  of the current session to a past datetime, then attempt verification.

**8.3. DPDP consent not checked.**
- On `/enroll/beanhouse_coffee`, enter a phone number but do NOT check the consent checkbox.
- Expected: "Send OTP" button is disabled (greyed out, not clickable).
- PASS: Button disabled without consent.
- FAIL: Button enabled without consent — a compliance violation.

**8.4. Direct /dashboard access without session.**
- Incognito window → `http://localhost:3000/dashboard` → expect redirect to `/login`.
- PASS: Redirect.
- FAIL: Dashboard loads. Middleware not working.

**8.5. Invalid enrollment slug.**
- Navigate to `http://localhost:3000/enroll/fakebrand`.
- Expected: Error page — "This enrollment link is invalid."
- PASS: Error shown, no enrollment form.
- FAIL: Generic form appears. Invalid slugs must not silently fall through.

**8.6. iOS enrollment (degradation test).**
- Open `http://localhost:3000/enroll/beanhouse_coffee` on an iPhone.
- Complete enrollment through to the success screen.
- Expected: The "Add to Google Wallet" button uses the standard `https://pay.google.com/...`
  URL, not the `intent://` URI (which is Android-only and would be a dead link on iOS).
- PASS: Link works as a web link on iOS (Google Wallet passes cannot be natively saved on
  iOS — this is expected behaviour, not a bug).
- FAIL: `intent://` URI is used on iOS — a completely broken link.

---

## Flow 9 — Admin & Customer OTP Error Differentiation

New in v4. Verifies the "OTP error differentiation" build noted as complete in
PROJECT_CONTEXT §3 — expired and invalid codes should no longer share one generic message.

**9.1. Customer path — invalid vs. expired copy differs.**
- Repeat Flow 8.1 (wrong code) and Flow 8.2 (expired code) back to back on
  `/enroll/beanhouse_coffee`, noting the exact error text shown each time.
- Expected: Two distinct messages — e.g. something like "That code isn't right, try again"
  for a wrong code vs. "That code has expired, request a new one" for an expired code.
- PASS: The two messages are visibly different and each accurately describes the failure.
- FAIL: Both cases show the same generic "Invalid or expired OTP" string.

**9.2. Admin path — invalid vs. expired copy differs.**
- On `/login`, request an OTP. First attempt: enter a deliberately wrong code and note the
  message. Then request a fresh OTP, wait past the TTL, and enter the correct-but-expired
  code, noting that message.
- Expected: Same distinction as 9.1, on the admin login path.
- PASS: Two distinct, accurate messages.
- FAIL: Generic shared message on either or both cases.

---

## Flow 10 — Dashboard Live Counts

New in v4. Verifies the dashboard is no longer static and reflects real DB state, per
PROJECT_CONTEXT §3 ("live database counts").

**10.1. Baseline counts load on dashboard open.**
- Log in as admin and land on `/dashboard`.
- Expected: Three visible stats — **Total Members**, **Passes Issued**, and a **Google
  Wallet Active** badge/indicator.
- PASS: All three are present and show numeric/status values, not placeholders or `0` if
  members already exist.
- FAIL: Static or hardcoded-looking values (e.g. round numbers that never change), or any
  of the three missing.

**10.2. Counts update after a new enrollment.**
- Note the current "Total Members" and "Passes Issued" values on the dashboard.
- In a separate tab, complete a fresh enrollment via `/enroll/beanhouse_coffee` or
  `/enroll/ironcore_gym` with a new phone number.
- Return to the dashboard and refresh.
- Expected: Both counts increment by exactly 1.
- PASS: Counts increment correctly and match the Supabase Table Editor row counts for
  `Member` and `Pass`.
- FAIL: Counts unchanged after refresh, or increment by an unexpected amount (check for
  double-counting or a caching issue).

**10.3. Cross-check counts against Supabase directly.**
- In Supabase Table Editor (or SQL Editor), get a row count for `Member` and `Pass` scoped
  to the admin's tenant.
- Compare against the dashboard's displayed numbers.
- PASS: Numbers match exactly.
- FAIL: Mismatch — the dashboard query may be missing a tenant filter, counting across all
  tenants instead of just the logged-in admin's own tenant.

---

## Flow 11 — Members List (`/dashboard/members`)

New in v4. Verifies the read-only members list page noted as complete in PROJECT_CONTEXT §3
and §4 ("Views and searches through all enrolled users via `/dashboard/members`").

**11.1. Members list loads with real data.**
- From `/dashboard`, navigate to `/dashboard/members` (via a nav link/tab, or directly).
- Expected: A list/table of enrolled members for the logged-in admin's tenant, showing at
  minimum name/phone and current balance or status per member.
- PASS: Real enrolled members appear (not placeholder rows).
- FAIL: Empty list despite members existing in Supabase, or a crash/error page.

**11.2. Members list is scoped to the correct tenant.**
- While logged in as the BeanHouse admin, confirm only BeanHouse-enrolled members appear —
  not IronCore members (or vice versa, depending on which admin is seeded).
- PASS: List is correctly tenant-scoped.
- FAIL: Members from other tenants leak into the list — a multi-tenant isolation bug (note
  this against the known multi-tenant gap called out at the end of this guide).

**11.3. Search/filter works.**
- If the page includes a search box, search for a known member's name or phone number
  fragment.
- Expected: The list filters down to matching members only.
- PASS: Filtering works correctly.
- FAIL: Search does nothing, or filters incorrectly.
- Note: per the Session Compact's scope decision, this page is **read-only for the PoC** —
  no segmentation or audit trail is expected here. Do not treat their absence as a fail.

**11.4. Confirm the page is auth-protected.**
- Incognito window → `http://localhost:3000/dashboard/members` → expect redirect to `/login`.
- PASS: Redirect happens, same as the rest of `/dashboard`.
- FAIL: Page loads without authentication.

---

## Demo Readiness Verdict

Mark each flow as you complete testing. All flows must pass before the demo.

- [ ] **Flow 1 — Pre-flight:** Dev server, Supabase DB, WAHA, env vars all verified
- [ ] **Flow 2 — Consumer enrollment (BeanHouse):** Tenant-scoped URL → real WhatsApp OTP → BeanHouse-branded pass → saved to Google Wallet via short link
- [ ] **Flow 2 — Consumer enrollment (IronCore):** Second brand spot-check passes with distinct branding
- [ ] **Flow 3 — Admin login:** Real WhatsApp OTP → httpOnly cookie set → `/dashboard` and `/scan` protected by middleware
- [ ] **Flow 4 — Template Designer:** Push template succeeds, enrollment QR code visible in dashboard
- [ ] **Flow 5 — Manage Live:** Balance update writes to DB, Google Wallet updates on device, WhatsApp receipt arrives
- [ ] **Flow 6 — IAB breakout:** Enrollment link tapped inside WhatsApp on Android opens Google Wallet natively; desktop degrades to `https://` URL correctly
- [ ] **Flow 7 — Staff scanner:** Dark-mode page, camera QR scan reads short-link pass ID, validate-pass returns from Supabase, redemption updates balance and fires WhatsApp receipt, duplicate guard blocks double-deduction, invalid and already-redeemed passes show clear rejection states
- [ ] **Flow 8 — Edge cases:** Wrong OTP blocked, expired OTP blocked, consent required, invalid slug shows error, `/dashboard` protected, iOS degrades correctly
- [ ] **Flow 9 — OTP error differentiation:** Invalid and expired codes show distinct, accurate messages on both admin and customer paths
- [ ] **Flow 10 — Dashboard live counts:** Total Members, Passes Issued, and Google Wallet Active badge reflect real, tenant-scoped Supabase data and update after new enrollments
- [ ] **Flow 11 — Members list:** `/dashboard/members` loads real, tenant-scoped, searchable member data and is auth-protected

---

## Known Gaps to Mention Verbally During the Demo (Not to Fix)

These are real gaps that exist in the PoC but are explicitly out of scope per the Demo PoC
Plan. If the founder or Mohit asks about them, acknowledge them directly and frame them as
the next build phase — not as oversights:

- **Multi-tenant access control is not hardened.** The demo shows two brands with distinct
  branding and `classId` namespacing, but an admin from BeanHouse could technically access
  IronCore data if they knew the URL. Full tenant isolation is a post-demo engineering task
  — this is also worth re-checking specifically via Flow 11.2 on the Members List.
- **No async job queue.** Google Wallet PATCH and WhatsApp receipts are decoupled `Promise`
  calls, not a retryable queue. A failed WAHA call is logged but not retried.
- **Consent logging is a timestamp, not a full audit trail.** IP address, user agent, and
  DPDP policy version are not yet captured.
- **Members list is read-only for this PoC.** No segmentation or audit trail — by design,
  per this session's scope decision, not a missing feature.
- **Apple Wallet, Samsung Wallet, Notifications Composer, Analytics, and the Consent
  Module are out of scope for this PoC entirely.** These are explicitly deferred to
  Phase 2, per the PRD v1 audit — not gaps in the current build.
