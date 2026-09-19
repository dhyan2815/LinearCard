-- Phase 2: per-tenant Google Wallet credentials + onboarding lifecycle.
-- All new credential columns are nullable and mean "fall back to env" when
-- null — this is a zero-downtime migration, not a data backfill of the
-- current single-issuer env config into every row.

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "issuerId" TEXT,
  ADD COLUMN IF NOT EXISTS "googleClientEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "googlePrivateKeyEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "businessDetails" JSONB,
  -- DEFAULT is 'production', not 'demo': every tenant on this system is
  -- already live and issuing passes today, and there is no test-account
  -- admin UI yet that could move a tenant out of 'demo'. Defaulting to
  -- 'demo' would have hard-blocked pass issuance for every existing tenant
  -- and member with no way to unblock. 'demo' stays a valid, explicitly-set
  -- state for a future onboarding flow.
  ADD COLUMN IF NOT EXISTS "publishStatus" TEXT NOT NULL DEFAULT 'production';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Tenant_publishStatus_check'
  ) THEN
    ALTER TABLE "Tenant"
      ADD CONSTRAINT "Tenant_publishStatus_check"
      CHECK ("publishStatus" IN ('demo', 'pending', 'production'));
  END IF;
END $$;

-- Explicit backfill for rows that existed before this migration: they are
-- live in production today, so that is the honest status to record.
UPDATE "Tenant"
SET "publishStatus" = 'production'
WHERE "publishStatus" IS NULL OR "publishStatus" = 'demo';

-- Minimal "registered test user" concept for demo-status pass issuance —
-- no existing allowlist/test-account concept in the codebase, so this adds
-- the smallest field that lets generate-pass gate on it.
ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "isTestAccount" BOOLEAN NOT NULL DEFAULT false;
