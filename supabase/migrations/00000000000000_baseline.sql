-- ==============================================================================
-- 00000000000000_baseline.sql
-- Baseline Supabase schema for LinearCard
-- Captures all 9 core tables: Tenant, Admin, Member, Pass, OtpSession,
-- ConsentLog, PassTemplate, AuditLog, NotificationLog.
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Tenant Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tenant" (
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

-- ------------------------------------------------------------------------------
-- 2. Admin Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Admin" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "phone" TEXT NOT NULL,
  "role" TEXT DEFAULT 'admin',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Member Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Member" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "consentedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. Pass Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Pass" (
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

-- ------------------------------------------------------------------------------
-- 5. OtpSession Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OtpSession" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "tenantId" UUID REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "purpose" TEXT NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "consumedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. ConsentLog Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ConsentLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "phone" TEXT NOT NULL,
  "consentedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "legalTextVersion" TEXT NOT NULL
);

-- ------------------------------------------------------------------------------
-- 7. PassTemplate Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PassTemplate" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "archetype" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "googleClassId" TEXT,
  "classSuffix" TEXT UNIQUE,
  "fieldRows" JSONB DEFAULT '[]'::jsonb,
  "hexBackgroundColor" TEXT,
  "logoUrl" TEXT,
  "heroImageUrl" TEXT,
  "linksModuleData" JSONB,
  "imageModulesData" JSONB,
  "textModulesData" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 8. AuditLog Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "action" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "actor" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 9. NotificationLog Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "NotificationLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "sentAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "header" TEXT,
  "body" TEXT
);

-- ------------------------------------------------------------------------------
-- Initial Seed Data: Tenants
-- ------------------------------------------------------------------------------
INSERT INTO "Tenant" ("id", "name", "classSuffix", "brandHexColor", "logoUrl", "heroUrl") VALUES
('a7ab209e-cbc4-4e6e-9b90-16911dbaba83', 'BeanHouse Coffee', 'beanhouse_coffee', '#8B4513', 'https://thumbs.dreamstime.com/b/print-185569850.jpg', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRD22nqPhUesXiH0WAO7qyQ1S9kYiwz6C2kr2I5IV--bw&s=10'),
('f1ab8b36-fc7f-4a92-9787-7e841ee3d09c', 'IronCore Fitness', 'ironcore_gym', '#FF4500', 'https://instagram.fbom19-5.fna.fbcdn.net/v/t51.82787-19/561528152_17845661892588141_7030587571237805673_n.jpg?_nc_cat=100&_nc_map=urlgen_bucketless&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=p_na1CrLlXMQ7kNvwF0I5Dl&_nc_oc=AdrBtTKlgn4rLAbzUfEveUiVgZPgcTOPoW8zFKbeLmisyWz1EKpncy7QQeKH61wkW5o&_nc_zt=24&_nc_ht=instagram.fbom19-5.fna&_nc_gid=GexwpfxBw0keP5uhS1xDUQ&_nc_ss=7b6a8&oh=00_AQJxnVbYSIm1R7_hWCKPdMrwupLhxmUoLqCXR8RLb1a2YA&oe=6AADA8B2', 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z3ltfGVufDB8fDB8fHww'),
('1830d14e-973d-4d4e-94c0-33a622340497', 'LinearCard Demo Pass', 'linearcard_demo', '#F97316', '/logo-linearcard.png', '')
ON CONFLICT ("classSuffix") DO NOTHING;
