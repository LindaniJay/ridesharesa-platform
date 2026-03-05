import { loadEnvFiles } from './scripts/load-env.mjs';
import { PrismaClient } from '@prisma/client';

loadEnvFiles();

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking if paymentReference column exists...\n');
  
  try {
    // Check if column exists
    const check = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Booking' AND column_name = 'paymentReference'
    `;
    
    if (Array.isArray(check) && check.length > 0) {
      console.log('✅ paymentReference column already exists!');
      console.log('\n Migration has already been applied.');
    } else {
      console.log('⚠️  Column not found. Applying migration...\n');
      
      // Add column
      await prisma.$executeRaw`
        ALTER TABLE "Booking" ADD COLUMN "paymentReference" TEXT
      `;
      console.log('✓ Added paymentReference column');
      
      // Add unique constraint (wrap in DO block to handle "already exists" error)
      await prisma.$executeRaw`
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'Booking_paymentReference_key'
            ) THEN
                ALTER TABLE "Booking" ADD CONSTRAINT "Booking_paymentReference_key" UNIQUE ("paymentReference");
            END IF;
        END $$;
      `;
      console.log('✓ Added unique constraint');
      
      // Add index
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "Booking_paymentReference_idx" ON "Booking"("paymentReference")
      `;
      console.log('✓ Added index');
      
      console.log('\n✅ Migration completed successfully!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
