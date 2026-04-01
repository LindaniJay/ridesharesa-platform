-- Add instantBooking column to Listing table (was in schema but never migrated)
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "instantBooking" BOOLEAN NOT NULL DEFAULT false;
