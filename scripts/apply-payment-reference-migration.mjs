import { Pool } from "pg";
import { loadEnvFiles } from "./load-env.mjs";

loadEnvFiles(process.cwd());

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DIRECT_URL or DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;');
    await client.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'Booking_paymentReference_key'
          ) THEN
              ALTER TABLE "Booking" ADD CONSTRAINT "Booking_paymentReference_key" UNIQUE ("paymentReference");
          END IF;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS "Booking_paymentReference_idx" ON "Booking"("paymentReference");');
    const check = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2', ["Booking", "paymentReference"]);
    if (check.rowCount && check.rowCount > 0) {
      console.log("Migration applied: Booking.paymentReference exists.");
    } else {
      console.error("Migration did not apply: column still missing.");
      process.exitCode = 1;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
