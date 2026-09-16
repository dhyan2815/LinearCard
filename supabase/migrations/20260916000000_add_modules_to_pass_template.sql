-- Migration: Add linksModuleData, imageModulesData, and textModulesData to PassTemplate
ALTER TABLE "PassTemplate"
ADD COLUMN IF NOT EXISTS "linksModuleData" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "imageModulesData" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "textModulesData" JSONB DEFAULT '[]'::jsonb;
