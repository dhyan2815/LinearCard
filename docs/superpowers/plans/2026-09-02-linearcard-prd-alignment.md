---BEGIN CONTENT---
# LinearCard PRD Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between LinearCard's current PoC state and 80% of the PRD's P0 functional requirements, covering OTP security, template persistence, member CRM, notification ledger, notifications composer, and dashboard polish.

**Architecture:** Multi-tenant Next.js 16 App Router app backed by Supabase (PostgreSQL). Three lib modules handle Google Wallet (REST API signing + JWT), WhatsApp (WAHA), and DB. Admin routes are protected by an HTTP-only JWT cookie set after OTP verification; consumer routes are public. New tables (`PassTemplate`, `AuditLog`, `NotificationLog`) extend the existing schema without dropping or altering any live data.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 7, Tailwind CSS v4, Supabase (PostgreSQL + `@supabase/supabase-js` service role), Google Wallet Generic Object REST API (`walletobjects.googleapis.com`), WAHA WhatsApp API, `jsonwebtoken` (RS256), `google-auth-library`, `lucide-react`, `motion/react`.

**Spec:** `docs/LinearCard_PRD_v1.md`

## Global Constraints

- Next.js `^16.3.3` — App Router only. No Pages Router.
- TypeScript 7 strict mode per `tsconfig.json`.
- Tailwind CSS v4 — use only semantic color tokens (`bg-canvas`, `text-ink-dark`, `bg-surface-card`, `border-border-subtle`, `text-brand-orange`, etc.). Zero hardcoded hex/color utilities.
- Supabase tables: PascalCase, always double-quoted in SQL (`"Tenant"`, `"Member"`, `"Pass"`, `"OtpSession"`, `"ConsentLog"`). All new tables follow the same convention.
- Google Wallet REST API base: `https://walletobjects.googleapis.com/walletobjects/v1/`
- Google Wallet auth scope: `https://www.googleapis.com/auth/wallet_object.issuer`
- WhatsApp via WAHA: POST `WAHA_BASE_URL/api/sendText`, body `{ session, chatId, text }`. `chatId` format: `919876543210@c.us` (E.164 minus the `+`).
- Phone numbers stored in E.164 format (e.g. `+919876543210`). Strip with `phone.replace(/[^\d+]/g, '')`.
- OTP: 4-digit numeric string. **SHA-256 hashed** before DB storage. 5-minute TTL.
- OTP rate limit: reject a new OTP request if an unconsumed, unexpired OTP already exists for the same `(phone, purpose)` pair.
- Pass archetypes (PRD §7.2): `loyalty`, `membership`, `id_card`, `access_badge`.
- Admin auth: HTTP-only cookie `admin_session` containing a JWT signed with `JWT_SECRET`. Verified with `jwt.verify(cookie, JWT_SECRET)`.
- No Apple Wallet, no Samsung Wallet, no SMS, no email in this plan.
- Do **not** add new npm packages. Use only what is in `package.json`.
- All image URLs sent to Google Wallet must be absolute. Convert relative `/…` paths with `request.nextUrl.origin + path`.
- Env vars: `ISSUER_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `JWT_SECRET`, `WAHA_BASE_URL`, `WAHA_API_KEY`, `WAHA_SESSION`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BASE_URL`.
- `balance` stored as `INTEGER` in DB, passed as string to Google Wallet and WhatsApp.

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `lib/otp.ts` | `hashOtp`, `verifyOtp`, `isOtpRateLimited` |
| `lib/notify.ts` | `logNotification` — writes to `NotificationLog` ledger |
| `supabase/migrations/001_pass_template.sql` | `PassTemplate` table |
| `supabase/migrations/002_audit_log.sql` | `AuditLog` table |
| `supabase/migrations/003_notification_log.sql` | `NotificationLog` table |
| `supabase/migrations/004_tenant_webhook.sql` | `webhookUrl` column on `Tenant` |
| `app/api/templates/route.ts` | `GET` list + `POST` create template |
| `app/api/templates/[id]/route.ts` | `GET`, `PATCH`, `DELETE` single template |
| `app/api/templates/[id]/publish/route.ts` | `POST` publish draft → push GenericClass |
| `app/api/notifications/send/route.ts` | `POST` bulk send to tenant members |
| `app/api/notifications/log/route.ts` | `GET` notification log for tenant |
| `app/api/members/[id]/route.ts` | `GET` member detail with passes + audit log |
| `app/api/members/[id]/adjust-balance/route.ts` | `POST` manual balance adjustment + audit entry |
| `app/api/settings/route.ts` | `GET`/`PATCH` tenant settings |
| `app/dashboard/members/[id]/page.tsx` | Member detail UI |
| `tests/otp-security.mjs` | OTP hash + verify unit test |
| `tests/schema-check.mjs` | Supabase table existence check |
| `tests/templates-api.mjs` | PassTemplate CRUD API test |
| `tests/notify-ledger.mjs` | NotificationLog schema test |
| `tests/notifications-api.mjs` | Notifications send/log API test |
| `tests/member-detail-api.mjs` | Member detail API test |
| `tests/dashboard-stats.mjs` | Dashboard stats shape test |

### Modified files

| File | What changes |
|---|---|
| `lib/whatsapp.ts` | Add `sendPassLinkWithLog`, `sendRedemptionReceiptWithLog` that log to `NotificationLog` |
| `app/api/send-otp/route.ts` | Use `hashOtp` + `isOtpRateLimited` |
| `app/api/admin/send-otp/route.ts` | Same as above for admin flow |
| `app/api/verify-otp/route.ts` | Use `verifyOtp` instead of plain equality |
| `app/api/admin/verify-otp/route.ts` | Same |
| `app/api/update-pass/route.ts` | Log wallet push + WhatsApp sends to ledger; log redemption to `AuditLog` |
| `app/api/generate-pass/route.ts` | Use `sendPassLinkWithLog` |
| `app/api/dashboard/stats/route.ts` | Add `walletStatus` object + `tierDistribution` |
| `app/dashboard/page.tsx` | Add Notifications tab, Settings tab, wallet status panel; archetype selector; draft/publish flow |
| `app/dashboard/members/page.tsx` | Make rows clickable → member detail page |
| `GEMINI.md` | Changelog entry |

---

## Task 1: OTP Security Hardening

**Files:**
- Create: `lib/otp.ts`
- Modify: `app/api/send-otp/route.ts`
- Modify: `app/api/admin/send-otp/route.ts`
- Modify: `app/api/verify-otp/route.ts`
- Modify: `app/api/admin/verify-otp/route.ts`
- Test: `tests/otp-security.mjs`

**Interfaces:**
- Produces:
  - `hashOtp(otp: string): string` — SHA-256 hex digest
  - `verifyOtp(plainOtp: string, hashedOtp: string): boolean` — timing-safe comparison
  - `isOtpRateLimited(phone: string, purpose: string, supabase: SupabaseClient): Promise<boolean>`

---

- [ ] **Step 1: Write the failing test**

```js
// tests/otp-security.mjs
import { createHash, timingSafeEqual } from 'crypto';

function hashOtp(otp) {
  return createHash('sha256').update(otp).digest('hex');
}

function verifyOtp(plain, hashed) {
  const plainHash = Buffer.from(hashOtp(plain));
  const stored   = Buffer.from(hashed);
  if (plainHash.length !== stored.length) return false;
  return timingSafeEqual(plainHash, stored);
}

const h1 = hashOtp('1234');
const h2 = hashOtp('1234');
console.assert(h1 === h2,       'FAIL: same OTP should hash identically');
console.assert(h1.length === 64, 'FAIL: SHA-256 hex should be 64 chars');
const h3 = hashOtp('5678');
console.assert(h1 !== h3,      'FAIL: different OTPs should hash differently');
console.assert(verifyOtp('1234', h1),  'FAIL: correct OTP should verify');
console.assert(!verifyOtp('9999', h1), 'FAIL: wrong OTP should not verify');
console.log('All OTP security tests pass.');
```

- [ ] **Step 2: Run test to confirm algorithm is correct**

```
node tests/otp-security.mjs
```
Expected: `All OTP security tests pass.`

- [ ] **Step 3: Create `lib/otp.ts`**

```typescript
import { createHash, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export function verifyOtp(plainOtp: string, hashedOtp: string): boolean {
  const plainHash = Buffer.from(hashOtp(plainOtp));
  const stored    = Buffer.from(hashedOtp);
  if (plainHash.length !== stored.length) return false;
  return timingSafeEqual(plainHash, stored);
}

export async function isOtpRateLimited(
  phone: string,
  purpose: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase
    .from('OtpSession')
    .select('id')
    .eq('phone', phone)
    .eq('purpose', purpose)
    .is('consumedAt', null)
    .gt('expiresAt', new Date().toISOString())
    .limit(1);
  return (data?.length ?? 0) > 0;
}
```

- [ ] **Step 4: Replace `app/api/send-otp/route.ts` entirely**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sendOtp } from '@/lib/whatsapp';
import { supabase } from '@/lib/db';
import { hashOtp, isOtpRateLimited } from '@/lib/otp';

export async function POST(request: NextRequest) {
  try {
    let { phone, tenantId } = await request.json();
    if (!phone) return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 });
    phone = phone.replace(/[^\d+]/g, '');

    if (await isOtpRateLimited(phone, 'enrollment', supabase)) {
      return NextResponse.json(
        { success: false, error: 'An OTP was recently sent. Please wait before requesting a new code.' },
        { status: 429 }
      );
    }

    const otp       = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    let brandName = 'LinearCard';
    if (tenantId) {
      const { data: tenant } = await supabase.from('Tenant').select('name').eq('id', tenantId).single();
      if (tenant) brandName = tenant.name;
    }

    const { error: insertError } = await supabase.from('OtpSession').insert({
      phone, otpHash: hashOtp(otp), purpose: 'enrollment', tenantId: tenantId || null, expiresAt,
    });
    if (insertError) throw new Error(`DB Error: ${insertError.message}`);

    await sendOtp(phone, otp, brandName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error sending OTP:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to send OTP' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Replace `app/api/admin/send-otp/route.ts` entirely**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sendOtp } from '@/lib/whatsapp';
import { supabase } from '@/lib/db';
import { hashOtp, isOtpRateLimited } from '@/lib/otp';

export async function POST(request: NextRequest) {
  try {
    let { phone } = await request.json();
    if (!phone) return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 });
    phone = phone.replace(/[^\d+]/g, '');

    if (await isOtpRateLimited(phone, 'admin_login', supabase)) {
      return NextResponse.json(
        { success: false, error: 'An OTP was recently sent. Please wait before requesting a new code.' },
        { status: 429 }
      );
    }

    const otp       = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabase.from('OtpSession').insert({
      phone, otpHash: hashOtp(otp), purpose: 'admin_login', expiresAt,
    });
    if (error) throw new Error(`DB Error: ${error.message}`);

    await sendOtp(phone, otp);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error sending Admin OTP:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to send OTP' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Update `app/api/verify-otp/route.ts` — add import and swap comparison**

Add at top after existing imports:
```typescript
import { verifyOtp } from '@/lib/otp';
```
Replace: `if (otpSession.otpHash !== otp) {`
With: `if (!verifyOtp(otp, otpSession.otpHash)) {`

- [ ] **Step 7: Update `app/api/admin/verify-otp/route.ts` — same swap**

Add at top:
```typescript
import { verifyOtp } from '@/lib/otp';
```
Replace: `if (otpSession.otpHash !== otp) {`
With: `if (!verifyOtp(otp, otpSession.otpHash)) {`

- [ ] **Step 8: Commit**

```bash
git add lib/otp.ts tests/otp-security.mjs \
        app/api/send-otp/route.ts \
        app/api/admin/send-otp/route.ts \
        app/api/verify-otp/route.ts \
        app/api/admin/verify-otp/route.ts
git commit -m "security: hash OTPs with SHA-256 and add rate limiting (PRD §7.3, §8)"
```

---

## Task 2: Supabase Schema Migrations

**Files:**
- Create: `supabase/migrations/001_pass_template.sql`
- Create: `supabase/migrations/002_audit_log.sql`
- Create: `supabase/migrations/003_notification_log.sql`
- Create: `supabase/migrations/004_tenant_webhook.sql`
- Test: `tests/schema-check.mjs`

**Interfaces:**
- Produces: `PassTemplate`, `AuditLog`, `NotificationLog` tables; `webhookUrl` column on `Tenant`
- Consumed by: Tasks 3, 4, 5, 6, 7, 8

---

- [ ] **Step 1: Write the failing test**

```js
// tests/schema-check.mjs
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function assertTableExists(tableName) {
  const { error } = await supabase.from(tableName).select('id').limit(1);
  if (error && error.code === '42P01') throw new Error(`FAIL: table "${tableName}" does not exist`);
  console.log(`✓ Table "${tableName}" exists`);
}

async function main() {
  await assertTableExists('PassTemplate');
  await assertTableExists('AuditLog');
  await assertTableExists('NotificationLog');
  console.log('All schema checks pass.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Run to confirm it fails**

```
node tests/schema-check.mjs
```
Expected: `FAIL: table "PassTemplate" does not exist`

- [ ] **Step 3: Create `supabase/migrations/001_pass_template.sql`**

```sql
CREATE TABLE "PassTemplate" (
  "id"                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId"           UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name"               TEXT NOT NULL,
  "archetype"          TEXT NOT NULL DEFAULT 'loyalty'
                         CHECK ("archetype" IN ('loyalty', 'membership', 'id_card', 'access_badge')),
  "classSuffix"        TEXT NOT NULL,
  "fieldRows"          JSONB NOT NULL DEFAULT '[]',
  "hexBackgroundColor" TEXT NOT NULL DEFAULT '#1A365D',
  "logoUrl"            TEXT,
  "heroImageUrl"       TEXT,
  "status"             TEXT NOT NULL DEFAULT 'draft'
                         CHECK ("status" IN ('draft', 'published')),
  "publishedAt"        TIMESTAMP WITH TIME ZONE,
  "createdAt"          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt"          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX "PassTemplate_tenantId_idx" ON "PassTemplate"("tenantId");
```

- [ ] **Step 4: Create `supabase/migrations/002_audit_log.sql`**

```sql
CREATE TABLE "AuditLog" (
  "id"            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId"      UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "memberId"      UUID REFERENCES "Member"("id") ON DELETE SET NULL,
  "passId"        UUID REFERENCES "Pass"("id") ON DELETE SET NULL,
  "adminId"       UUID REFERENCES "Admin"("id") ON DELETE SET NULL,
  "action"        TEXT NOT NULL,
  "previousValue" JSONB,
  "newValue"      JSONB,
  "note"          TEXT,
  "createdAt"     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX "AuditLog_passId_idx"   ON "AuditLog"("passId");
CREATE INDEX "AuditLog_memberId_idx" ON "AuditLog"("memberId");
```

- [ ] **Step 5: Create `supabase/migrations/003_notification_log.sql`**

```sql
CREATE TABLE "NotificationLog" (
  "id"             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId"       UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "memberId"       UUID REFERENCES "Member"("id") ON DELETE SET NULL,
  "channel"        TEXT NOT NULL CHECK ("channel" IN ('whatsapp', 'wallet_push')),
  "status"         TEXT NOT NULL CHECK ("status" IN ('sent', 'failed')),
  "messageContent" TEXT,
  "errorReason"    TEXT,
  "sentAt"         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX "NotificationLog_tenantId_idx" ON "NotificationLog"("tenantId");
CREATE INDEX "NotificationLog_memberId_idx" ON "NotificationLog"("memberId");
```

- [ ] **Step 6: Create `supabase/migrations/004_tenant_webhook.sql`**

```sql
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "webhookUrl" TEXT;
```

- [ ] **Step 7: Run all four SQL files in Supabase SQL Editor, then verify**

```
node tests/schema-check.mjs
```
Expected: all four `✓` lines + `All schema checks pass.`

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/ tests/schema-check.mjs
git commit -m "db: add PassTemplate, AuditLog, NotificationLog, Tenant.webhookUrl (PRD §7.2,§7.4,§7.5,§7.9)"
```

---

## Task 3: PassTemplate CRUD + Publish API

**Files:**
- Create: `app/api/templates/route.ts`
- Create: `app/api/templates/[id]/route.ts`
- Create: `app/api/templates/[id]/publish/route.ts`
- Test: `tests/templates-api.mjs`

**Interfaces:**
- Consumes: `PassTemplate` table (Task 2), `createGenericClass` from `lib/google-wallet.ts`
- Produces:
  - `GET /api/templates?tenantId` → `{ success, templates: PassTemplate[] }`
  - `POST /api/templates` → `{ success, template: PassTemplate }` — status defaults to `'draft'`
  - `GET /api/templates/[id]` → `{ success, template }`
  - `PATCH /api/templates/[id]` → `{ success, template }`
  - `DELETE /api/templates/[id]` → `{ success }`
  - `POST /api/templates/[id]/publish` → `{ success, classData, template }` — status becomes `'published'`

---

- [ ] **Step 1: Write the failing test**

```js
// tests/templates-api.mjs
import 'dotenv/config';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function test() {
  const tenantsData = await (await fetch(`${BASE_URL}/api/tenants`)).json();
  if (!tenantsData.success || tenantsData.tenants.length === 0)
    throw new Error('No tenants — run seed data first');
  const tenantId = tenantsData.tenants[0].id;

  const createData = await (await fetch(`${BASE_URL}/api/templates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId, name: 'Test Loyalty Card', archetype: 'loyalty',
      classSuffix: 'test_loyalty_001',
      fieldRows: [{ id: 'row1', columns: [{ header: 'Points', body: '0' }, { header: 'Tier', body: 'Bronze' }] }],
      hexBackgroundColor: '#1A365D',
    }),
  })).json();
  console.assert(createData.success,                     `FAIL POST: ${JSON.stringify(createData)}`);
  console.assert(createData.template.status === 'draft', 'FAIL: should be draft');
  const templateId = createData.template.id;
  console.log('✓ POST /api/templates');

  const listData = await (await fetch(`${BASE_URL}/api/templates?tenantId=${tenantId}`)).json();
  console.assert(listData.success,                                    'FAIL GET list');
  console.assert(listData.templates.some(t => t.id === templateId),  'FAIL: template missing');
  console.log('✓ GET /api/templates');

  const patchData = await (await fetch(`${BASE_URL}/api/templates/${templateId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Updated Loyalty Card' }),
  })).json();
  console.assert(patchData.success,                                   'FAIL PATCH');
  console.assert(patchData.template.name === 'Updated Loyalty Card',  'FAIL: name not updated');
  console.log('✓ PATCH /api/templates/[id]');

  const badRes = await fetch(`${BASE_URL}/api/templates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, name: 'Bad', archetype: 'coupon', classSuffix: 'x' }),
  });
  console.assert(badRes.status === 400, 'FAIL: invalid archetype should be 400');
  console.log('✓ Archetype validation');

  const delData = await (await fetch(`${BASE_URL}/api/templates/${templateId}`, { method: 'DELETE' })).json();
  console.assert(delData.success, 'FAIL DELETE');
  console.log('✓ DELETE /api/templates/[id]');
  console.log('All template API tests pass.');
}
test().catch(e => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Run to confirm it fails**

```
node tests/templates-api.mjs
```
Expected: `FAIL POST: ...` (route does not exist)

- [ ] **Step 3: Create `app/api/templates/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

const VALID_ARCHETYPES = ['loyalty', 'membership', 'id_card', 'access_badge'] as const;

export async function GET(request: NextRequest) {
  try {
    const tenantId = new URL(request.url).searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ success: false, error: 'tenantId is required' }, { status: 400 });
    const { data: templates, error } = await supabase
      .from('PassTemplate').select('*').eq('tenantId', tenantId).order('createdAt', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, templates: templates || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, name, archetype, classSuffix, fieldRows, hexBackgroundColor, logoUrl, heroImageUrl } = body;
    if (!tenantId || !name || !archetype || !classSuffix)
      return NextResponse.json({ success: false, error: 'tenantId, name, archetype, and classSuffix are required' }, { status: 400 });
    if (!VALID_ARCHETYPES.includes(archetype))
      return NextResponse.json({ success: false, error: `archetype must be one of: ${VALID_ARCHETYPES.join(', ')}` }, { status: 400 });
    const { data: template, error } = await supabase
      .from('PassTemplate')
      .insert({ tenantId, name, archetype, classSuffix, fieldRows: fieldRows || [], hexBackgroundColor: hexBackgroundColor || '#1A365D', logoUrl: logoUrl || null, heroImageUrl: heroImageUrl || null, status: 'draft' })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `app/api/templates/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

const VALID = ['loyalty', 'membership', 'id_card', 'access_badge'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: template, error } = await supabase.from('PassTemplate').select('*').eq('id', id).single();
    if (error || !template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    return NextResponse.json({ success: true, template });
  } catch (error: any) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, archetype, fieldRows, hexBackgroundColor, logoUrl, heroImageUrl } = await request.json();
    const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) patch.name = name;
    if (fieldRows !== undefined) patch.fieldRows = fieldRows;
    if (hexBackgroundColor !== undefined) patch.hexBackgroundColor = hexBackgroundColor;
    if (logoUrl !== undefined) patch.logoUrl = logoUrl;
    if (heroImageUrl !== undefined) patch.heroImageUrl = heroImageUrl;
    if (archetype !== undefined) {
      if (!VALID.includes(archetype)) return NextResponse.json({ success: false, error: 'Invalid archetype' }, { status: 400 });
      patch.archetype = archetype;
    }
    const { data: template, error } = await supabase.from('PassTemplate').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, template });
  } catch (error: any) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await supabase.from('PassTemplate').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}
```

- [ ] **Step 5: Create `app/api/templates/[id]/publish/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { createGenericClass } from '@/lib/google-wallet';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: template, error: fetchError } = await supabase
      .from('PassTemplate').select('*, tenant:Tenant(*)').eq('id', id).single();
    if (fetchError || !template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });

    const origin       = request.nextUrl.origin;
    const logoUrl      = template.logoUrl?.startsWith('/')      ? `${origin}${template.logoUrl}`      : template.logoUrl;
    const heroImageUrl = template.heroImageUrl?.startsWith('/') ? `${origin}${template.heroImageUrl}` : template.heroImageUrl;

    const classData = await createGenericClass({
      classSuffix: template.classSuffix, cardTitle: template.tenant?.name || template.name,
      hexBackgroundColor: template.hexBackgroundColor, rows: template.fieldRows, logoUrl, heroImageUrl,
    });

    const { data: updated, error: updateError } = await supabase
      .from('PassTemplate')
      .update({ status: 'published', publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .eq('id', id).select().single();
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, classData, template: updated });
  } catch (error: any) {
    console.error('Error publishing template:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run the test**

```
node tests/templates-api.mjs
```
Expected: `All template API tests pass.`

- [ ] **Step 7: Commit**

```bash
git add app/api/templates/ tests/templates-api.mjs
git commit -m "feat: PassTemplate CRUD + publish API — draft/publish state (PRD §7.2)"
```

---

## Task 4: Template Builder — Archetype + DB Persistence

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `GET /api/templates?tenantId`, `POST /api/templates`, `PATCH /api/templates/[id]`, `POST /api/templates/[id]/publish` (Task 3)
- Produces: Archetype selector (4 buttons), draft/publish status badge, "Save as Draft" + "Publish to Wallet" buttons

---

- [ ] **Step 1: Add `ARCHETYPES` constant and update `designData` + add template tracking state in `app/dashboard/page.tsx`**

Replace the existing `const [designData, setDesignData] = useState({...})` block with:

```typescript
const ARCHETYPES = [
  { value: 'loyalty',      label: 'Loyalty Pass' },
  { value: 'membership',   label: 'Membership Card' },
  { value: 'id_card',      label: 'ID Card' },
  { value: 'access_badge', label: 'Access Badge' },
] as const;
type Archetype = typeof ARCHETYPES[number]['value'];

const [designData, setDesignData] = useState({
  classSuffix: 'linearcard_sandbox_class', archetype: 'loyalty' as Archetype,
  cardTitle: 'The SkyHigh Alliance', hexBackgroundColor: '#1A365D',
  logoUrl: '', heroImageUrl: '',
  rows: [{ id: 'row1', columns: [{ header: 'Points', body: '500' }, { header: 'Tier', body: 'Gold' }] }]
});
const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
const [templateStatus,  setTemplateStatus]  = useState<'unsaved' | 'draft' | 'published'>('unsaved');
```

- [ ] **Step 2: Add archetype selector into the Design tab form (after the `classSuffix` input)**

```tsx
<div className="space-y-1">
  <Label>Pass Archetype</Label>
  <div className="grid grid-cols-2 gap-2">
    {ARCHETYPES.map((arch) => (
      <button key={arch.value} type="button"
        onClick={() => setDesignData(prev => ({ ...prev, archetype: arch.value }))}
        className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
          designData.archetype === arch.value
            ? 'bg-brand-orange/10 border-brand-orange text-brand-orange'
            : 'bg-surface-bone border-border-subtle text-ink-secondary hover:border-border-strong'
        }`}>
        {arch.label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Replace the existing single "Push Design" button with status badge + two-button flow**

```tsx
{templateStatus !== 'unsaved' && (
  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
    templateStatus === 'published'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${templateStatus === 'published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
    {templateStatus === 'published' ? 'Published to Wallet' : 'Draft saved'}
  </div>
)}

<div className="flex gap-2 pt-2">
  <Button type="button" variant="secondary" className="flex-1" onClick={async () => {
    try {
      if (savedTemplateId) {
        const res = await fetch(`/api/templates/${savedTemplateId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: designData.cardTitle, archetype: designData.archetype, fieldRows: designData.rows, hexBackgroundColor: designData.hexBackgroundColor, logoUrl: designData.logoUrl || null, heroImageUrl: designData.heroImageUrl || null }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
      } else {
        const res = await fetch('/api/templates', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: selectedTenantId, name: designData.cardTitle || 'New Template', archetype: designData.archetype, classSuffix: designData.classSuffix, fieldRows: designData.rows, hexBackgroundColor: designData.hexBackgroundColor, logoUrl: designData.logoUrl || null, heroImageUrl: designData.heroImageUrl || null }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setSavedTemplateId(data.template.id);
      }
      setTemplateStatus('draft');
    } catch (err: any) { alert(`Failed to save draft: ${err.message}`); }
  }}>Save as Draft</Button>

  <Button type="button" className="flex-1" onClick={async () => {
    let tplId = savedTemplateId;
    if (!tplId) {
      try {
        const res = await fetch('/api/templates', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: selectedTenantId, name: designData.cardTitle || 'New Template', archetype: designData.archetype, classSuffix: designData.classSuffix, fieldRows: designData.rows, hexBackgroundColor: designData.hexBackgroundColor, logoUrl: designData.logoUrl || null, heroImageUrl: designData.heroImageUrl || null }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        tplId = data.template.id; setSavedTemplateId(tplId);
      } catch (err: any) { alert(`Failed: ${err.message}`); return; }
    }
    try {
      const res = await fetch(`/api/templates/${tplId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setTemplateStatus('published'); alert('Template published!');
    } catch (err: any) { alert(`Publish failed: ${err.message}`); }
  }}>Publish to Wallet</Button>
</div>
```

- [ ] **Step 4: Start dev server and manually verify**

```
npm run dev
```
Navigate: `http://localhost:3000/login` → login → Dashboard → Design tab.
1. ☐ 4 archetype buttons render, clicking highlights in orange.
2. ☐ "Save as Draft" inserts a `PassTemplate` row with `status = 'draft'`.
3. ☐ Amber badge "Draft saved" appears.
4. ☐ "Publish to Wallet" calls `/api/templates/[id]/publish`, badge turns green "Published to Wallet".

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: template builder — archetype selector + draft/publish flow (PRD §7.2)"
```

---

## Task 5: Notification Delivery Ledger

**Files:**
- Create: `lib/notify.ts`
- Modify: `lib/whatsapp.ts`
- Modify: `app/api/update-pass/route.ts`
- Modify: `app/api/verify-otp/route.ts`
- Modify: `app/api/generate-pass/route.ts`
- Test: `tests/notify-ledger.mjs`

**Interfaces:**
- Consumes: `NotificationLog` table (Task 2)
- Produces:
  - `logNotification(opts): Promise<void>` — never throws
  - `sendPassLinkWithLog(phone, walletUrl, memberName, brandName, { tenantId, memberId? }): Promise<void>`
  - `sendRedemptionReceiptWithLog(phone, newBalance, brandName, { tenantId, memberId? }): Promise<void>`

---

- [ ] **Step 1: Write the failing test**

```js
// tests/notify-ledger.mjs
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function test() {
  const { data: tenants } = await supabase.from('Tenant').select('id').limit(1);
  if (!tenants?.length) throw new Error('No tenant found');
  const tenantId = tenants[0].id;
  const { data, error } = await supabase.from('NotificationLog')
    .insert({ tenantId, channel: 'whatsapp', status: 'sent', messageContent: 'Test' })
    .select().single();
  if (error) throw new Error(`FAIL inserting NotificationLog: ${error.message}`);
  console.assert(data.channel === 'whatsapp', 'FAIL: channel mismatch');
  console.assert(data.status  === 'sent',     'FAIL: status mismatch');
  await supabase.from('NotificationLog').delete().eq('id', data.id);
  console.log('NotificationLog schema test passes.');
}
test().catch(e => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Run (will pass if Task 2 migrations ran)**

```
node tests/notify-ledger.mjs
```
Expected: `NotificationLog schema test passes.`

- [ ] **Step 3: Create `lib/notify.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

export interface LogNotificationOpts {
  supabase: SupabaseClient;
  tenantId: string;
  memberId?: string;
  channel: 'whatsapp' | 'wallet_push';
  status: 'sent' | 'failed';
  messageContent?: string;
  errorReason?: string;
}

/** Never throws — logging failures must not crash the main request. */
export async function logNotification(opts: LogNotificationOpts): Promise<void> {
  const { supabase, tenantId, memberId, channel, status, messageContent, errorReason } = opts;
  try {
    await supabase.from('NotificationLog').insert({
      tenantId, memberId: memberId || null, channel, status,
      messageContent: messageContent || null, errorReason: errorReason || null,
    });
  } catch (err) { console.error('[notify] Failed to write NotificationLog:', err); }
}
```

- [ ] **Step 4: Append logged wrappers to `lib/whatsapp.ts` (do not remove existing exports)**

```typescript
// Logged wrappers — append at bottom of lib/whatsapp.ts
import { logNotification } from '@/lib/notify';
import { supabase } from '@/lib/db';

export async function sendPassLinkWithLog(
  phone: string, walletUrl: string, memberName: string, brandName: string,
  opts: { tenantId: string; memberId?: string }
): Promise<void> {
  const text = `🎉 Welcome, ${memberName}!\n\nYour *${brandName}* loyalty pass is ready.\n\nTap to add it to Google Wallet:\n${walletUrl}\n\n_Powered by LinearCard_`;
  try {
    await wahaPost('/api/sendText', { chatId: toWahaId(phone), text });
    await logNotification({ supabase, tenantId: opts.tenantId, memberId: opts.memberId, channel: 'whatsapp', status: 'sent', messageContent: text });
  } catch (err: any) {
    await logNotification({ supabase, tenantId: opts.tenantId, memberId: opts.memberId, channel: 'whatsapp', status: 'failed', messageContent: text, errorReason: err.message });
    throw err;
  }
}

export async function sendRedemptionReceiptWithLog(
  phone: string, newBalance: string, brandName: string,
  opts: { tenantId: string; memberId?: string }
): Promise<void> {
  const text = `✅ *Transaction Confirmed*\n\nYour *${brandName}* balance has been updated.\n\nNew Balance: *${newBalance}*\n\n_Your wallet pass will refresh automatically._`;
  try {
    await wahaPost('/api/sendText', { chatId: toWahaId(phone), text });
    await logNotification({ supabase, tenantId: opts.tenantId, memberId: opts.memberId, channel: 'whatsapp', status: 'sent', messageContent: text });
  } catch (err: any) {
    await logNotification({ supabase, tenantId: opts.tenantId, memberId: opts.memberId, channel: 'whatsapp', status: 'failed', messageContent: text, errorReason: err.message });
    throw err;
  }
}
```

- [ ] **Step 5: Update `app/api/update-pass/route.ts` — wire ledger for wallet push + WhatsApp**

Add at top (after existing imports):
```typescript
import { sendRedemptionReceiptWithLog } from '@/lib/whatsapp';
import { logNotification } from '@/lib/notify';
```
Remove the `sendRedemptionReceipt` import.

Replace the `Promise.all([...])` block:
```typescript
Promise.all([
  updateGenericObject(pass.fullPassId, { balance: balance.toString(), tier: tier || pass.tier, pushNotification })
    .then(() => logNotification({ supabase, tenantId: pass.tenantId, memberId: pass.memberId, channel: 'wallet_push', status: 'sent', messageContent: pushNotification }))
    .catch(err => logNotification({ supabase, tenantId: pass.tenantId, memberId: pass.memberId, channel: 'wallet_push', status: 'failed', errorReason: err.message })),
  (pass.Member?.phone || phone)
    ? sendRedemptionReceiptWithLog(pass.Member?.phone || phone, balance.toString(), pass.Tenant?.name || brandName || 'LinearCard', { tenantId: pass.tenantId, memberId: pass.memberId })
        .catch(err => console.error('WhatsApp receipt failed (non-fatal):', err))
    : Promise.resolve()
]).catch(err => console.error('Async follow-up failed (non-fatal):', err));
```

- [ ] **Step 6: Update `app/api/verify-otp/route.ts` — use `sendPassLinkWithLog`**

Replace `import { sendPassLink } from '@/lib/whatsapp'` with `import { sendPassLinkWithLog } from '@/lib/whatsapp'`.

Replace the `sendPassLink(...)` call with:
```typescript
if (passResult.googleWalletUrl && passRecordId) {
  const shortUrl = `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/api/p/${passRecordId}`;
  sendPassLinkWithLog(phone, shortUrl, passData.memberName || phone, tenant.name, { tenantId: targetTenantId, memberId: member.id })
    .catch(err => console.error('WhatsApp pass link failed (non-fatal):', err));
}
```

- [ ] **Step 7: Update `app/api/generate-pass/route.ts` — same swap**

Replace `sendPassLink` import with `sendPassLinkWithLog`. Replace its call:
```typescript
if (body.deliverWhatsapp && body.phone && passRecordId) {
  const shortUrl = `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/api/p/${passRecordId}`;
  sendPassLinkWithLog(body.phone, shortUrl, body.memberName || 'Member', body.cardTitle || 'LinearCard', { tenantId: targetTenantId, memberId: member.id })
    .catch(e => console.error('WAHA delivery error:', e));
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/notify.ts lib/whatsapp.ts \
        app/api/update-pass/route.ts \
        app/api/verify-otp/route.ts \
        app/api/generate-pass/route.ts \
        tests/notify-ledger.mjs
git commit -m "feat: durable notification delivery ledger — whatsapp + wallet push (PRD §7.5, §8)"
```

---

## Task 6: Notifications Composer UI + Send API

**Files:**
- Create: `app/api/notifications/send/route.ts`
- Create: `app/api/notifications/log/route.ts`
- Modify: `app/dashboard/page.tsx`
- Test: `tests/notifications-api.mjs`

**Interfaces:**
- Consumes: `NotificationLog` (Task 5), `Member`+`Pass` tables, `updateGenericObject`, `logNotification`
- Produces:
  - `POST /api/notifications/send` body `{ tenantId, channel, message }` → `{ success, sent, failed }`
  - `GET /api/notifications/log?tenantId&limit` → `{ success, logs }`
  - Notifications tab: channel toggle, textarea, send button, recent sends list

---

- [ ] **Step 1: Write the failing test**

```js
// tests/notifications-api.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function test() {
  const { data: tenants } = await supabase.from('Tenant').select('id').limit(1);
  const tenantId = tenants[0].id;

  const logData = await (await fetch(`${BASE_URL}/api/notifications/log?tenantId=${tenantId}`)).json();
  console.assert(logData.success,            `FAIL GET log: ${JSON.stringify(logData)}`);
  console.assert(Array.isArray(logData.logs), 'FAIL: logs must be an array');
  console.log('✓ GET /api/notifications/log');

  const badRes = await fetch(`${BASE_URL}/api/notifications/send`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, channel: 'email', message: 'Test' }),
  });
  console.assert(badRes.status === 400, 'FAIL: invalid channel should be 400');
  console.log('✓ Channel validation');

  const noMsgRes = await fetch(`${BASE_URL}/api/notifications/send`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, channel: 'wallet_push' }),
  });
  console.assert(noMsgRes.status === 400, 'FAIL: missing message should be 400');
  console.log('✓ Message required');

  console.log('All notifications API tests pass.');
}
test().catch(e => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Run to confirm it fails**

```
node tests/notifications-api.mjs
```
Expected: `FAIL GET log:` (route doesn't exist)

- [ ] **Step 3: Create `app/api/notifications/log/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const params   = new URL(request.url).searchParams;
    const tenantId = params.get('tenantId');
    const limit    = parseInt(params.get('limit') || '50', 10);
    if (!tenantId) return NextResponse.json({ success: false, error: 'tenantId is required' }, { status: 400 });
    const { data: logs, error } = await supabase
      .from('NotificationLog')
      .select('*, member:Member(name, phone)')
      .eq('tenantId', tenantId)
      .order('sentAt', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({ success: true, logs: logs || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `app/api/notifications/send/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { logNotification } from '@/lib/notify';
import { updateGenericObject } from '@/lib/google-wallet';

const VALID_CHANNELS = ['whatsapp', 'wallet_push'] as const;
type Channel = typeof VALID_CHANNELS[number];

async function wahaPost(endpoint: string, body: object) {
  const WAHA_BASE_URL = process.env.WAHA_BASE_URL;
  const WAHA_SESSION  = process.env.WAHA_SESSION ?? 'default';
  const WAHA_API_KEY  = process.env.WAHA_API_KEY;
  if (!WAHA_BASE_URL) return;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (WAHA_API_KEY) headers['X-Api-Key'] = WAHA_API_KEY;
  const res = await fetch(`${WAHA_BASE_URL.replace(/\/$/, '')}${endpoint}`, {
    method: 'POST', headers, body: JSON.stringify({ session: WAHA_SESSION, ...body }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`WAHA error ${res.status}: ${t}`); }
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId, channel, message } = await request.json();
    if (!tenantId || !channel || !message)
      return NextResponse.json({ success: false, error: 'tenantId, channel, and message are required' }, { status: 400 });
    if (!VALID_CHANNELS.includes(channel as Channel))
      return NextResponse.json({ success: false, error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` }, { status: 400 });

    const { data: members, error: memberError } = await supabase
      .from('Member').select('id, phone, name, passes:Pass(id, fullPassId)').eq('tenantId', tenantId);
    if (memberError) throw memberError;
    if (!members?.length) return NextResponse.json({ success: true, sent: 0, failed: 0, message: 'No members' });

    let sent = 0, failed = 0;
    for (const member of members) {
      try {
        if (channel === 'whatsapp') {
          await wahaPost('/api/sendText', { chatId: `${member.phone.replace(/^\+/, '')}@c.us`, text: message });
          await logNotification({ supabase, tenantId, memberId: member.id, channel: 'whatsapp', status: 'sent', messageContent: message });
          sent++;
        } else {
          const passes: any[] = (member as any).passes || [];
          if (!passes.length) {
            await logNotification({ supabase, tenantId, memberId: member.id, channel: 'wallet_push', status: 'failed', messageContent: message, errorReason: 'No pass' });
            failed++; continue;
          }
          for (const pass of passes) {
            await updateGenericObject(pass.fullPassId, { pushNotification: message });
            await logNotification({ supabase, tenantId, memberId: member.id, channel: 'wallet_push', status: 'sent', messageContent: message });
          }
          sent++;
        }
      } catch (err: any) {
        await logNotification({ supabase, tenantId, memberId: member.id, channel: channel as Channel, status: 'failed', messageContent: message, errorReason: err.message });
        failed++;
      }
    }
    return NextResponse.json({ success: true, sent, failed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Wire Notifications tab into `app/dashboard/page.tsx`**

Update `activeTab` type to include `'notifications'`:
```typescript
const [activeTab, setActiveTab] = useState<'design' | 'issue' | 'manage' | 'notifications'>('design');
```

Add tab button alongside Design/Issue/Manage:
```tsx
<button onClick={() => setActiveTab('notifications')} className={tabClass('notifications')}>
  <Bell className="w-4 h-4" /> Notify
</button>
```

Add `Bell` to the lucide-react import.

Add panel:
```tsx
{activeTab === 'notifications' && <NotificationsTab tenantId={selectedTenantId} />}
```

Add `NotificationsTab` component above `Dashboard`:
```tsx
function NotificationsTab({ tenantId }: { tenantId: string }) {
  const [channel,   setChannel]   = React.useState<'whatsapp' | 'wallet_push'>('whatsapp');
  const [message,   setMessage]   = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [result,    setResult]    = React.useState<{ sent: number; failed: number } | null>(null);
  const [logs,      setLogs]      = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/notifications/log?tenantId=${tenantId}&limit=20`)
      .then(r => r.json()).then(d => { if (d.success) setLogs(d.logs); });
  }, [tenantId, result]);

  const handleSend = async () => {
    if (!tenantId || !message.trim()) return;
    setIsSending(true); setResult(null);
    try {
      const data = await (await fetch('/api/notifications/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, channel, message }),
      })).json();
      if (!data.success) throw new Error(data.error);
      setResult({ sent: data.sent, failed: data.failed }); setMessage('');
    } catch (err: any) { alert(`Failed: ${err.message}`); }
    finally { setIsSending(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-ink-dark flex items-center gap-2">
          <Bell className="w-4 h-4 text-brand-orange" /> Compose Notification
        </h3>
        <div className="flex gap-2">
          {(['whatsapp', 'wallet_push'] as const).map(ch => (
            <button key={ch} onClick={() => setChannel(ch)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                channel === ch ? 'bg-brand-orange/10 border-brand-orange text-brand-orange'
                  : 'bg-surface-bone border-border-subtle text-ink-secondary hover:border-border-strong'
              }`}>
              {ch === 'whatsapp' ? '💬 WhatsApp' : '📲 Wallet Push'}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <Label>Message</Label>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            placeholder={channel === 'whatsapp' ? 'e.g. Earn double points this weekend!' : 'e.g. Your pass has been updated.'}
            rows={4} className="w-full rounded-xl border border-border-subtle bg-surface-bone text-ink-dark text-sm px-4 py-3 focus:outline-none focus:border-brand-orange resize-none" />
        </div>
        {result && <p className="text-sm text-emerald-400 font-medium">✓ Sent to {result.sent} members.{result.failed > 0 ? ` ${result.failed} failed.` : ''}</p>}
        <Button onClick={handleSend} disabled={!message.trim() || isSending || !tenantId} className="w-full">
          {isSending ? 'Sending...' : 'Send to All Members'}
        </Button>
      </Card>
      {logs.length > 0 && (
        <Card className="p-6">
          <h3 className="text-base font-semibold text-ink-dark mb-4">Recent Sends</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-border-subtle/50 last:border-0 text-sm">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${log.status === 'sent' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-ink-secondary truncate">{log.messageContent}</p>
                  <p className="text-ink-muted text-xs">{log.channel} · {log.member?.name || log.member?.phone || 'Unknown'} · {new Date(log.sentAt).toLocaleString()}</p>
                  {log.errorReason && <p className="text-red-400 text-xs">{log.errorReason}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the test**

```
node tests/notifications-api.mjs
```
Expected: `All notifications API tests pass.`

- [ ] **Step 7: Commit**

```bash
git add app/api/notifications/ app/dashboard/page.tsx tests/notifications-api.mjs
git commit -m "feat: notifications composer tab + send API + delivery ledger UI (PRD §7.5)"
```

---

## Task 7: Member Detail Page + Audit Trail

**Files:**
- Create: `app/api/members/[id]/route.ts`
- Create: `app/api/members/[id]/adjust-balance/route.ts`
- Create: `app/dashboard/members/[id]/page.tsx`
- Modify: `app/dashboard/members/page.tsx`
- Test: `tests/member-detail-api.mjs`

**Interfaces:**
- Consumes: `Member`, `Pass`, `AuditLog`, `ConsentLog`; `updateGenericObject`; `logNotification`
- Produces:
  - `GET /api/members/[id]` → `{ success, member: { ...Member, passes, auditLog, consentLog } }`
  - `POST /api/members/[id]/adjust-balance` body `{ passId, newBalance, newTier?, note? }` → `{ success }`

---

- [ ] **Step 1: Write the failing test**

```js
// tests/member-detail-api.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function test() {
  const { data: members } = await supabase.from('Member').select('id').limit(1);
  if (!members?.length) { console.log('No members — enroll a user first.'); return; }
  const memberId = members[0].id;

  const data = await (await fetch(`${BASE_URL}/api/members/${memberId}`)).json();
  console.assert(data.success,                          `FAIL GET /api/members/[id]: ${JSON.stringify(data)}`);
  console.assert(data.member.id === memberId,           'FAIL: id mismatch');
  console.assert(Array.isArray(data.member.passes),     'FAIL: passes not an array');
  console.assert(Array.isArray(data.member.auditLog),   'FAIL: auditLog not an array');
  console.log('✓ GET /api/members/[id]');

  const notFound = await fetch(`${BASE_URL}/api/members/00000000-0000-0000-0000-000000000000`);
  console.assert(notFound.status === 404, 'FAIL: unknown member should be 404');
  console.log('✓ 404 for unknown member');

  console.log('All member detail API tests pass.');
}
test().catch(e => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Run to confirm it fails**

```
node tests/member-detail-api.mjs
```
Expected: `FAIL GET /api/members/[id]`

- [ ] **Step 3: Create `app/api/members/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: member, error } = await supabase.from('Member').select('*').eq('id', id).single();
    if (error || !member) return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });

    const [{ data: passes }, { data: auditLog }, { data: consentLog }] = await Promise.all([
      supabase.from('Pass').select('*').eq('memberId', id).order('createdAt', { ascending: false }),
      supabase.from('AuditLog').select('*').eq('memberId', id).order('createdAt', { ascending: false }).limit(50),
      supabase.from('ConsentLog').select('*').eq('memberId', id).order('consentedAt', { ascending: false }),
    ]);

    return NextResponse.json({ success: true, member: { ...member, passes: passes || [], auditLog: auditLog || [], consentLog: consentLog || [] } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `app/api/members/[id]/adjust-balance/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { updateGenericObject } from '@/lib/google-wallet';
import { logNotification } from '@/lib/notify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-demo-key';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: memberId } = await params;
    const cookie = request.cookies.get('admin_session');
    if (!cookie?.value) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    let adminPayload: any;
    try { adminPayload = jwt.verify(cookie.value, JWT_SECRET); }
    catch { return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 }); }

    const { passId, newBalance, newTier, note } = await request.json();
    if (passId === undefined || newBalance === undefined)
      return NextResponse.json({ success: false, error: 'passId and newBalance are required' }, { status: 400 });

    const parsedBalance = parseInt(String(newBalance), 10);
    if (isNaN(parsedBalance) || parsedBalance < 0)
      return NextResponse.json({ success: false, error: 'newBalance must be a non-negative integer' }, { status: 400 });

    const { data: pass, error: passError } = await supabase.from('Pass').select('*').eq('id', passId).eq('memberId', memberId).single();
    if (passError || !pass) return NextResponse.json({ success: false, error: 'Pass not found for this member' }, { status: 404 });

    const previousValue = { balance: pass.balance, tier: pass.tier };
    const newTierValue  = newTier || pass.tier;

    const { error: updateError } = await supabase.from('Pass')
      .update({ balance: parsedBalance, tier: newTierValue, updatedAt: new Date().toISOString() }).eq('id', passId);
    if (updateError) throw updateError;

    await supabase.from('AuditLog').insert({
      tenantId: pass.tenantId, memberId, passId, adminId: adminPayload.adminId || null,
      action: 'manual_balance_adjustment',
      previousValue, newValue: { balance: parsedBalance, tier: newTierValue },
      note: note || null,
    });

    const pushMessage = note || `Your balance was updated to ${parsedBalance} points.`;
    Promise.all([
      updateGenericObject(pass.fullPassId, { balance: parsedBalance.toString(), tier: newTierValue, pushNotification: pushMessage })
        .then(() => logNotification({ supabase, tenantId: pass.tenantId, memberId, channel: 'wallet_push', status: 'sent', messageContent: pushMessage }))
        .catch(err => logNotification({ supabase, tenantId: pass.tenantId, memberId, channel: 'wallet_push', status: 'failed', errorReason: err.message })),
    ]).catch(err => console.error('Async adjust failed:', err));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create `app/dashboard/members/[id]/page.tsx`**

```tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, History, Edit3 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import Link from 'next/link';

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [member,     setMember]     = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [selectedPassId, setSelectedPassId] = useState('');
  const [newBalance,     setNewBalance]     = useState('');
  const [newTier,        setNewTier]        = useState('');
  const [note,           setNote]           = useState('');
  const [isAdjusting,    setIsAdjusting]    = useState(false);
  const [adjustMsg,      setAdjustMsg]      = useState('');

  const loadMember = async () => {
    const data = await (await fetch(`/api/members/${id}`)).json();
    if (data.success) {
      setMember(data.member);
      if (data.member.passes?.length > 0) {
        setSelectedPassId(data.member.passes[0].id);
        setNewBalance(String(data.member.passes[0].balance));
        setNewTier(data.member.passes[0].tier || '');
      }
    } else setError(data.error || 'Failed to load member');
    setLoading(false);
  };

  useEffect(() => { loadMember(); }, [id]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPassId) return;
    setIsAdjusting(true); setAdjustMsg('');
    try {
      const res  = await fetch(`/api/members/${id}/adjust-balance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passId: selectedPassId, newBalance: parseInt(newBalance, 10), newTier, note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setAdjustMsg('Balance adjusted. Wallet pass will update shortly.');
      await loadMember();
    } catch (err: any) { setAdjustMsg(`Error: ${err.message}`); }
    finally { setIsAdjusting(false); }
  };

  if (loading) return <main className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" /></main>;
  if (error)   return <main className="flex-1 flex items-center justify-center"><p className="text-red-500">{error}</p></main>;

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 space-y-6">
      <Link href="/dashboard/members" className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-dark transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Members
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink-dark tracking-tight">{member.name || 'Unknown Member'}</h1>
            <p className="text-ink-secondary font-mono text-sm mt-1">{member.phone}</p>
          </div>
          {member.consentedAt && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" /> DPDP Consented
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-canvas p-3 rounded-xl border border-border-subtle">
            <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1">Enrolled</p>
            <p className="text-sm font-medium text-ink-dark">{new Date(member.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="bg-canvas p-3 rounded-xl border border-border-subtle">
            <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1">Passes</p>
            <p className="text-sm font-medium text-ink-dark">{member.passes?.length ?? 0}</p>
          </div>
          {member.passes?.[0] && (
            <div className="bg-canvas p-3 rounded-xl border border-border-subtle">
              <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-widest mb-1">Balance</p>
              <p className="text-sm font-medium text-ink-dark">{member.passes[0].balance} pts · {member.passes[0].tier}</p>
            </div>
          )}
        </div>
      </Card>

      {member.passes?.length > 0 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-ink-dark flex items-center gap-2 mb-4">
            <Edit3 className="w-4 h-4 text-brand-orange" /> Adjust Balance
          </h2>
          <form onSubmit={handleAdjust} className="space-y-4">
            {member.passes.length > 1 && (
              <div className="space-y-1">
                <Label>Select Pass</Label>
                <select value={selectedPassId} onChange={e => { setSelectedPassId(e.target.value); const p = member.passes.find((p: any) => p.id === e.target.value); if (p) { setNewBalance(String(p.balance)); setNewTier(p.tier || ''); } }}
                  className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-ink-dark focus:outline-none focus:border-brand-orange">
                  {member.passes.map((p: any) => <option key={p.id} value={p.id}>{p.fullPassId} — {p.balance} pts</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>New Balance (pts)</Label>
                <Input type="number" min="0" value={newBalance} onChange={e => setNewBalance(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>New Tier</Label>
                <Input type="text" value={newTier} onChange={e => setNewTier(e.target.value)} placeholder="e.g. Gold" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Admin Note (audit trail)</Label>
              <Input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Bonus for feedback survey" />
            </div>
            {adjustMsg && <p className={`text-sm font-medium ${adjustMsg.startsWith('Error') ? 'text-red-500' : 'text-emerald-400'}`}>{adjustMsg}</p>}
            <Button type="submit" disabled={isAdjusting || !newBalance} className="w-full">
              {isAdjusting ? 'Applying...' : 'Apply Adjustment'}
            </Button>
          </form>
        </Card>
      )}

      {member.auditLog?.length > 0 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-ink-dark flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-brand-orange" /> Audit Trail
          </h2>
          <div className="space-y-1">
            {member.auditLog.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-3 py-3 border-b border-border-subtle/50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-brand-orange mt-2 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-dark capitalize">{entry.action.replace(/_/g, ' ')}</p>
                  {entry.previousValue && entry.newValue && (
                    <p className="text-xs text-ink-secondary">
                      {entry.previousValue.balance} → {entry.newValue.balance} pts
                      {entry.previousValue.tier !== entry.newValue.tier ? ` · ${entry.previousValue.tier} → ${entry.newValue.tier}` : ''}
                    </p>
                  )}
                  {entry.note && <p className="text-xs text-ink-muted italic">{entry.note}</p>}
                  <p className="text-xs text-ink-muted mt-0.5">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {member.consentLog?.length > 0 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-ink-dark flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-brand-orange" /> Consent Records
          </h2>
          <div className="space-y-2">
            {member.consentLog.map((entry: any) => (
              <div key={entry.id} className="text-sm text-ink-secondary py-2 border-b border-border-subtle/50 last:border-0">
                <span className="text-emerald-400 font-medium">Consented</span> — {entry.legalTextVersion} · {new Date(entry.consentedAt).toLocaleString()}
                {entry.ipAddress && <span className="text-ink-muted ml-2 text-xs">from {entry.ipAddress}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Make member rows clickable in `app/dashboard/members/page.tsx`**

Add at top: `import { useRouter } from 'next/navigation';`

Add inside component: `const router = useRouter();`

Change `<tr key=...>` to:
```tsx
<tr
  key={`${item.id}-${item.pass?.id || idx}`}
  className="hover:bg-surface-bone/50 transition-colors cursor-pointer"
  onClick={() => router.push(`/dashboard/members/${item.id}`)}
>
```

- [ ] **Step 7: Run test**

```
node tests/member-detail-api.mjs
```
Expected: `All member detail API tests pass.`

- [ ] **Step 8: Commit**

```bash
git add app/api/members/[id]/ app/dashboard/members/ tests/member-detail-api.mjs
git commit -m "feat: member detail page + audit trail + manual balance adjustment (PRD §7.4)"
```

---

## Task 8: Dashboard Overview Polish + Settings Tab

**Files:**
- Modify: `app/api/dashboard/stats/route.ts`
- Create: `app/api/settings/route.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `GEMINI.md`
- Test: `tests/dashboard-stats.mjs`

**Interfaces:**
- Consumes: `Tenant`, `Member`, `Pass` tables
- Produces:
  - `GET /api/dashboard/stats` → `{ success, memberCount, passCount, walletStatus: { google, apple, samsung }, tierDistribution: Record<string, number> }`
  - `GET /api/settings` (admin cookie) → `{ success, tenant }`
  - `PATCH /api/settings` body `{ webhookUrl? }` → `{ success }`

---

- [ ] **Step 1: Write the failing test**

```js
// tests/dashboard-stats.mjs
import 'dotenv/config';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function test() {
  const data = await (await fetch(`${BASE_URL}/api/dashboard/stats`)).json();
  console.assert(data.success,                   `FAIL: ${JSON.stringify(data)}`);
  console.assert('memberCount'      in data,     'FAIL: memberCount missing');
  console.assert('passCount'        in data,     'FAIL: passCount missing');
  console.assert('walletStatus'     in data,     'FAIL: walletStatus missing');
  console.assert('tierDistribution' in data,     'FAIL: tierDistribution missing — new field');
  console.assert('google' in data.walletStatus,  'FAIL: walletStatus.google missing');
  console.log('Dashboard stats test passes.');
}
test().catch(e => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Run to confirm `tierDistribution` is absent**

```
node tests/dashboard-stats.mjs
```
Expected: `FAIL: tierDistribution missing — new field`

- [ ] **Step 3: Replace `app/api/dashboard/stats/route.ts` entirely**

```typescript
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    const [{ count: memberCount }, { count: passCount }, { data: passTiers }] = await Promise.all([
      supabase.from('Member').select('*', { count: 'exact', head: true }),
      supabase.from('Pass').select('*', { count: 'exact', head: true }),
      supabase.from('Pass').select('tier'),
    ]);

    const tierDistribution: Record<string, number> = {};
    (passTiers || []).forEach((p: any) => {
      const t = p.tier || 'Unknown';
      tierDistribution[t] = (tierDistribution[t] || 0) + 1;
    });

    const googleConnected = !!(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.ISSUER_ID);

    return NextResponse.json({
      success: true,
      memberCount: memberCount || 0,
      passCount:   passCount   || 0,
      tierDistribution,
      walletStatus: {
        google:  googleConnected ? 'connected' : 'not_configured',
        apple:   'not_configured',
        samsung: 'pending_approval',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `app/api/settings/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-demo-key';

async function getTenantId(request: NextRequest): Promise<string | null> {
  const cookie = request.cookies.get('admin_session');
  if (!cookie?.value) return null;
  try { const p: any = jwt.verify(cookie.value, JWT_SECRET); return p.tenantId || null; }
  catch { return null; }
}

export async function GET(request: NextRequest) {
  const tenantId = await getTenantId(request);
  if (!tenantId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { data: tenant, error } = await supabase
    .from('Tenant').select('id, name, classSuffix, brandHexColor, apiKey, webhookUrl').eq('id', tenantId).single();
  if (error || !tenant) return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
  return NextResponse.json({ success: true, tenant });
}

export async function PATCH(request: NextRequest) {
  const tenantId = await getTenantId(request);
  if (!tenantId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { webhookUrl } = await request.json();
  const patch: Record<string, any> = {};
  if (webhookUrl !== undefined) {
    if (webhookUrl && !/^https?:\/\/.+/.test(webhookUrl))
      return NextResponse.json({ success: false, error: 'webhookUrl must be a valid http/https URL' }, { status: 400 });
    patch.webhookUrl = webhookUrl || null;
  }
  if (!Object.keys(patch).length)
    return NextResponse.json({ success: false, error: 'No updateable fields provided' }, { status: 400 });
  const { error } = await supabase.from('Tenant').update(patch).eq('id', tenantId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Add `WalletStatusPill` and update `stats` state in `app/dashboard/page.tsx`**

Update `stats` state type:
```typescript
const [stats, setStats] = useState<{
  memberCount: number; passCount: number;
  walletStatus: { google: string; apple: string; samsung: string };
  tierDistribution: Record<string, number>;
}>({
  memberCount: 0, passCount: 0,
  walletStatus: { google: 'loading', apple: 'not_configured', samsung: 'pending_approval' },
  tierDistribution: {},
});
```

Add `WalletStatusPill` above `Dashboard`:
```tsx
function WalletStatusPill({ label, status }: { label: string; status: string }) {
  const colors: Record<string, string> = {
    connected: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    not_configured: 'bg-zinc-500/10 text-ink-muted border-border-subtle',
    pending_approval: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    loading: 'bg-zinc-500/10 text-ink-muted border-border-subtle',
  };
  const dot: Record<string, string> = {
    connected: 'bg-emerald-500 animate-pulse', not_configured: 'bg-zinc-500',
    pending_approval: 'bg-amber-500', loading: 'bg-zinc-400',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${colors[status] || colors.not_configured}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status] || dot.not_configured}`} />
      {label}: {status.replace(/_/g, ' ')}
    </div>
  );
}
```

Add wallet status row below existing stat cards:
```tsx
<div className="flex flex-wrap gap-2 mt-4">
  <WalletStatusPill label="Google Wallet" status={stats.walletStatus.google} />
  <WalletStatusPill label="Apple Wallet"  status={stats.walletStatus.apple} />
  <WalletStatusPill label="Samsung Wallet" status={stats.walletStatus.samsung} />
</div>
```

- [ ] **Step 6: Add Settings tab to `app/dashboard/page.tsx`**

Update `activeTab` type to include `'settings'`. Add tab button. Add panel `{activeTab === 'settings' && <SettingsTab />}`.

Add `SettingsTab` above `Dashboard`:
```tsx
function SettingsTab() {
  const [tenant,     setTenant]     = React.useState<any>(null);
  const [webhookUrl, setWebhookUrl] = React.useState('');
  const [isSaving,   setIsSaving]   = React.useState(false);
  const [isRotating, setIsRotating] = React.useState(false);
  const [msg,        setMsg]        = React.useState('');

  React.useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.success) { setTenant(d.tenant); setWebhookUrl(d.tenant.webhookUrl || ''); }
    });
  }, []);

  const handleSaveWebhook = async () => {
    setIsSaving(true); setMsg('');
    try {
      const data = await (await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhookUrl }) })).json();
      if (!data.success) throw new Error(data.error);
      setMsg('Webhook URL saved.');
    } catch (err: any) { setMsg(`Error: ${err.message}`); }
    finally { setIsSaving(false); }
  };

  const handleRotateKey = async () => {
    if (!confirm('Rotate API key? The old key stops working immediately.')) return;
    setIsRotating(true);
    try {
      const data = await (await fetch('/api/admin/developer-settings', { method: 'POST' })).json();
      if (!data.success) throw new Error(data.error);
      setTenant((prev: any) => ({ ...prev, apiKey: data.apiKey }));
      setMsg('API key rotated.');
    } catch (err: any) { setMsg(`Error: ${err.message}`); }
    finally { setIsRotating(false); }
  };

  if (!tenant) return <p className="text-ink-muted text-sm">Loading settings...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-ink-dark">API Key</h3>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-surface-bone border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono text-ink-secondary truncate">
            {tenant.apiKey || 'No key generated'}
          </code>
          <Button onClick={handleRotateKey} disabled={isRotating} variant="secondary" className="shrink-0">
            {isRotating ? 'Rotating...' : 'Rotate'}
          </Button>
        </div>
        <p className="text-xs text-ink-muted">Pass as <code>Authorization: Bearer &lt;key&gt;</code> for API calls.</p>
      </Card>
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-ink-dark">Webhook URL</h3>
        <div className="space-y-1">
          <Label>Endpoint URL</Label>
          <Input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://your-server.com/webhook/linearcard" />
        </div>
        <p className="text-xs text-ink-muted">LinearCard will POST signed events here (HMAC-SHA256 signing in a future release).</p>
        {msg && <p className={`text-sm font-medium ${msg.startsWith('Error') ? 'text-red-500' : 'text-emerald-400'}`}>{msg}</p>}
        <Button onClick={handleSaveWebhook} disabled={isSaving} className="w-full">
          {isSaving ? 'Saving...' : 'Save Webhook URL'}
        </Button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Run test**

```
node tests/dashboard-stats.mjs
```
Expected: `Dashboard stats test passes.`

- [ ] **Step 8: Append to `GEMINI.md` changelog**

```
- **2026-09-02**: Executed PRD alignment plan (docs/superpowers/plans/2026-09-02-linearcard-prd-alignment.md). Completed 8 tasks: (1) OTP SHA-256 hashing + rate limiting, (2) Supabase migrations for PassTemplate/AuditLog/NotificationLog/Tenant.webhookUrl, (3) PassTemplate CRUD + publish API, (4) Template Builder archetype selector + draft/publish flow, (5) Durable notification delivery ledger wiring WhatsApp and wallet push, (6) Notifications Composer tab + send API + recent sends log, (7) Member Detail page with audit trail and admin balance adjustment, (8) Dashboard wallet status panel + Settings tab with webhook URL config.
```

- [ ] **Step 9: Commit**

```bash
git add app/api/dashboard/stats/route.ts \
        app/api/settings/route.ts \
        app/dashboard/page.tsx \
        GEMINI.md \
        tests/dashboard-stats.mjs
git commit -m "feat: dashboard wallet status panel + settings tab + tier distribution (PRD §7.1, §7.9)"
```

---

## Self-Review

### 1. Spec Coverage

| PRD Requirement | Task | Status |
|---|---|---|
| §7.1 Dashboard — wallet platform connection status | Task 8 | ✅ |
| §7.1 Dashboard — member/pass counts | Task 8 | ✅ |
| §7.2 Template Builder — live preview (pre-existing) | — | ✅ |
| §7.2 Template Builder — 4 archetypes | Task 4 | ✅ |
| §7.2 Template Builder — draft/publish state | Tasks 3, 4 | ✅ |
| §7.2 Template Builder — immutable field keys | `PassTemplate.classSuffix` = immutable key; `fieldRows` stores display labels | ✅ |
| §7.3 OTP — E.164, consent, specific error messages | Existing + Task 1 | ✅ |
| §7.3 OTP — rate limiting (1 active OTP per phone) | Task 1 | ✅ |
| §7.3 OTP — secure hash storage (SHA-256) | Task 1 | ✅ |
| §7.4 Members list with search/filter | Existing | ✅ |
| §7.4 Member detail — pass history | Task 7 | ✅ |
| §7.4 Member detail — manual balance adjustment + audit trail | Task 7 | ✅ |
| §7.5 Notifications Composer — WhatsApp | Task 6 | ✅ |
| §7.5 Notifications Composer — wallet push | Task 6 | ✅ |
| §7.5 Durable notification delivery ledger | Tasks 2, 5 | ✅ |
| §7.6 Scan/Redeem (existing) | — | ✅ |
| §7.7 Analytics | P1 — deferred per PRD | 🔶 |
| §7.8 Consent captured at enrollment | Existing | ✅ |
| §7.8 Consent records visible to admin | Task 7 (member detail) | ✅ |
| §7.9 Settings — API key rotation | Existing | ✅ |
| §7.9 Settings — webhook URL config | Task 8 | ✅ |
| §7.9 Settings — accurate wallet status | Task 8 | ✅ |
| §8 OTP hashing | Task 1 | ✅ |
| §8 Durable notification ledger | Tasks 2, 5 | ✅ |
| §8 Multi-tenant isolation | Existing | ✅ |
| §8 Idempotency keys | Deferred P2 | 🔶 |
| §8 HMAC-signed webhooks | URL saved, signing deferred P2 | 🔶 |
| Apple Web Service Protocol (5 endpoints) | Deferred — PRD says scope conservatively | 🔶 |
| Samsung Wallet | PRD Non-Goal | 🔶 |

### 2. Placeholder Scan

None. No `TBD`, `TODO`, `fill in`, `handle edge cases`, or `similar to Task N` patterns. All steps have actual code.

### 3. Type Consistency

- `hashOtp(otp: string): string` — defined Task 1 `lib/otp.ts`, imported in all 4 route files with same signature.
- `verifyOtp(plainOtp: string, hashedOtp: string): boolean` — defined Task 1, used in both verify routes with matching parameter order.
- `logNotification(opts: LogNotificationOpts): Promise<void>` — defined Task 5, called in Tasks 5, 6, 7 with same `opts` shape.
- `sendPassLinkWithLog` / `sendRedemptionReceiptWithLog` — defined Task 5, imported and called in Tasks 5 route files.
- `walletStatus` shape changes from `string` to `{ google, apple, samsung }` — Dashboard `stats` state type updated to match in Task 8.
- `PassTemplate.fieldRows` is `JSONB` in SQL (Task 2) and `any[]` in TypeScript (Tasks 3, 4) — consistent.
- `AuditLog.previousValue/newValue` are `JSONB` in SQL and `Record<string,any>` in TS — consistent across Task 7 route and member detail page.

---

## Deferred Items

| Item | Reason |
|---|---|
| Apple Web Service Protocol (5 endpoints) | Most complex integration; PRD explicitly says "scope conservatively" |
| Samsung Wallet | PRD Non-Goal — blocked on external Samsung Partner Agreement |
| HMAC-signed webhooks | P2 in PRD; webhook URL persisted, signing logic is next phase |
| Idempotency-Key header | P2 in PRD |
| Analytics page (§7.7) | P1 in PRD, explicitly Phase 2 |
| SMS / Email notification channels | Q4-B decision |
| Admin data-subject deletion flow | Q5-B decision |
---END CONTENT---
