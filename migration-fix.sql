-- Quick migration to add paymentReference column
-- Run this directly if migration deploy is hanging

-- Add the column
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;

-- Add unique constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Booking_paymentReference_key'
    ) THEN
        ALTER TABLE "Booking" ADD CONSTRAINT "Booking_paymentReference_key" UNIQUE ("paymentReference");
    END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS "Booking_paymentReference_idx" ON "Booking"("paymentReference");

-- Verify
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Booking' AND column_name = 'paymentReference';
