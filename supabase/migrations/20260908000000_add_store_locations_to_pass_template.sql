-- Add storeLocations JSONB column to PassTemplate.
-- Each element: { latitude: number, longitude: number, label?: string }
-- Google Wallet supports a maximum of 10 locations per GenericClass.
ALTER TABLE "PassTemplate"
  ADD COLUMN "storeLocations" JSONB NOT NULL DEFAULT '[]'::jsonb;
