-- Phase 3: Program -> Tier tables, replacing the JSONB tierThresholds array
-- on PassTemplate with real, FK-linked rows. PassTemplate.tierThresholds and
-- Pass.tier (both TEXT/JSONB) are left in place during this migration
-- window (matches the ApiKey/Tenant.apiKey coexistence pattern from Phase
-- 1D) -- nothing here drops them.

CREATE TABLE IF NOT EXISTS "Program" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Program_tenantId_idx" ON "Program"("tenantId");
-- Safeguard: one canonical Program per tenant. If a future bug (or a
-- concurrent insert) tries to create a second Program for the same tenant,
-- this constraint catches it loudly instead of silently merging tiers
-- across programs in the wallet.service.ts fetch query.
CREATE UNIQUE INDEX IF NOT EXISTS "Program_tenantId_unique" ON "Program"("tenantId");

CREATE TABLE IF NOT EXISTS "Tier" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "programId" UUID NOT NULL REFERENCES "Program"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "minPoints" INTEGER NOT NULL DEFAULT 0,
  "templateId" UUID NOT NULL REFERENCES "PassTemplate"("id") ON DELETE CASCADE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Tier_programId_idx" ON "Tier"("programId");
CREATE INDEX IF NOT EXISTS "Tier_templateId_idx" ON "Tier"("templateId");

ALTER TABLE "Pass" ADD COLUMN IF NOT EXISTS "tierId" UUID REFERENCES "Tier"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Pass_tierId_idx" ON "Pass"("tierId");

-- Backfill: exactly ONE Program per tenant (not per PassTemplate), seeded
-- from that tenant's single canonical tiered template. Candidate templates
-- are those with a non-empty tierThresholds array; among a tenant's
-- candidates we pick status = 'published' first, tie-broken by the most
-- recently updated (DISTINCT ON with this ORDER BY keeps exactly one row
-- per tenantId). One Tier row is inserted per threshold entry in that
-- chosen template's tierThresholds array, preserving array order via
-- sortOrder. A tenant with no tiered templates gets no Program.
DO $$
DECLARE
  tpl RECORD;
  threshold JSONB;
  new_program_id UUID;
  idx INTEGER;
BEGIN
  FOR tpl IN
    SELECT DISTINCT ON ("tenantId") "id", "tenantId", "title", "tierThresholds"
    FROM "PassTemplate"
    WHERE "tierThresholds" IS NOT NULL
      AND jsonb_typeof("tierThresholds") = 'array'
      AND jsonb_array_length("tierThresholds") > 0
    ORDER BY "tenantId", ("status" = 'published') DESC, "updatedAt" DESC
  LOOP
    INSERT INTO "Program" ("tenantId", "name")
    VALUES (tpl."tenantId", tpl."title" || ' Tiers')
    RETURNING "id" INTO new_program_id;

    idx := 0;
    FOR threshold IN SELECT * FROM jsonb_array_elements(tpl."tierThresholds")
    LOOP
      INSERT INTO "Tier" ("programId", "name", "minPoints", "templateId", "sortOrder")
      VALUES (
        new_program_id,
        COALESCE(threshold->>'name', 'Tier ' || idx),
        COALESCE((threshold->>'min')::INTEGER, 0),
        tpl."id",
        idx
      );
      idx := idx + 1;
    END LOOP;
  END LOOP;
END $$;
