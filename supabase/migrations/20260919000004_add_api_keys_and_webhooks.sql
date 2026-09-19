-- Phase 1D: hashed API keys and outbound webhooks.
-- Tenant.apiKey stays readable during the migration window (TenantGuard
-- falls back to it when no ApiKey row matches) but new keys are only ever
-- issued into ApiKey, hashed.

CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" TEXT,
  "prefix" TEXT NOT NULL,
  "hash" TEXT NOT NULL UNIQUE,
  "lastUsedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");

CREATE TABLE IF NOT EXISTS "WebhookEndpoint" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "events" TEXT[] NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_tenantId_idx" ON "WebhookEndpoint"("tenantId");

CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "endpointId" UUID NOT NULL REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "statusCode" INTEGER,
  "responseBody" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WebhookDelivery_endpointId_idx" ON "WebhookDelivery"("endpointId");
