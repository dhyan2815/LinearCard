-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenant Table
CREATE TABLE "Tenant" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "name" TEXT NOT NULL,
  "classSuffix" TEXT UNIQUE NOT NULL,
  "brandHexColor" TEXT NOT NULL,
  "logoUrl" TEXT NOT NULL,
  "heroUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "apiKey" TEXT UNIQUE,
  "webhookUrl" TEXT
);

-- Admin Table
CREATE TABLE "Admin" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "phone" TEXT NOT NULL,
  "role" TEXT DEFAULT 'admin',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Member Table
CREATE TABLE "Member" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "consentedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pass Table
CREATE TABLE "Pass" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "fullPassId" TEXT UNIQUE NOT NULL,
  "barcodeAlt" TEXT,
  "balance" INTEGER DEFAULT 0,
  "tier" TEXT DEFAULT 'Bronze',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OtpSession Table
CREATE TABLE "OtpSession" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "tenantId" UUID REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "purpose" TEXT NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "consumedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ConsentLog Table
CREATE TABLE "ConsentLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "phone" TEXT NOT NULL,
  "consentedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "legalTextVersion" TEXT NOT NULL
);

-- PassTemplate Table
CREATE TABLE IF NOT EXISTS "PassTemplate" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "archetype" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "googleClassId" TEXT,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AuditLog Table
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "action" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "actor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- NotificationLog Table
CREATE TABLE IF NOT EXISTS "NotificationLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "sentAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data
INSERT INTO "Tenant" ("id", "name", "classSuffix", "brandHexColor", "logoUrl", "heroUrl") VALUES
(uuid_generate_v4(), 'BeanHouse Coffee', 'beanhouse_coffee', '#8B4513', '/logo-beanhouse.png', '/hero-beanhouse.png'),
(uuid_generate_v4(), 'IronCore Fitness', 'ironcore_gym', '#FF4500', '/logo-ironcore.png', '/hero-ironcore.png'),
(uuid_generate_v4(), 'LinearCard Demo Pass', 'linearcard_demo', '#F97316', '/logo-linearcard.png', '/hero-linearcard.png')
ON CONFLICT ("classSuffix") DO NOTHING;
