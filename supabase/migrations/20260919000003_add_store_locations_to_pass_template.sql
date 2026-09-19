-- Adds geofencing pin storage for Google Wallet merchantLocations proximity
-- notifications. Up to 10 lat/lng pairs, validated at the API layer.
ALTER TABLE "PassTemplate"
  ADD COLUMN IF NOT EXISTS "storeLocations" JSONB NOT NULL DEFAULT '[]';
