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
  "apiKey" TEXT UNIQUE
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

-- Seed Data
INSERT INTO "Tenant" ("id", "name", "classSuffix", "brandHexColor", "logoUrl", "heroUrl") VALUES
(uuid_generate_v4(), 'BeanHouse Coffee', 'beanhouse_coffee', '#8B4513', '/logo-beanhouse.png', '/hero-beanhouse.png'),
(uuid_generate_v4(), 'IronCore Fitness', 'ironcore_gym', '#FF4500', '/logo-ironcore.png', '/hero-ironcore.png'),
(uuid_generate_v4(), 'LinearCard Demo Pass', 'linearcard_demo', '#F97316', '/logo-linearcard.png', '/hero-linearcard.png')
ON CONFLICT ("classSuffix") DO NOTHING;
