ALTER TABLE "Pass"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ NULL;

COMMENT ON COLUMN "Pass"."deletedAt" IS
'Set when Google Wallet sends a "del" callback (user removed the pass from their wallet). NULL means the pass is active.';
