DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageRecipientRole') THEN
		CREATE TYPE "MessageRecipientRole" AS ENUM ('HOST', 'ADMIN');
	END IF;
END $$;

ALTER TABLE "BookingMessage" ADD COLUMN IF NOT EXISTS "recipientRole" "MessageRecipientRole";

CREATE INDEX IF NOT EXISTS "BookingMessage_recipientRole_idx" ON "BookingMessage"("recipientRole");
