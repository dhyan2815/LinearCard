CREATE TABLE IF NOT EXISTS "PassTemplate" (
    "id" UUID DEFAULT uuid_generate_v4(),
    "tenantId" UUID NOT NULL,
    "archetype" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "googleClassId" TEXT,
    "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassTemplate_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PassTemplate_tenantId_fkey'
    ) THEN
        ALTER TABLE "PassTemplate" ADD CONSTRAINT "PassTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
