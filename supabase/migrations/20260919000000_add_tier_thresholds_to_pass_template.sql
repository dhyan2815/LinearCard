ALTER TABLE "PassTemplate"
ADD COLUMN IF NOT EXISTS "tierThresholds" JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "PassTemplate"."tierThresholds" IS
'Ordered array of {name: string, min: number} point thresholds used to auto-compute a member''s tier from their Pass.balance. Example: [{"name":"Bronze","min":0},{"name":"Silver","min":500},{"name":"Gold","min":2000}]';
