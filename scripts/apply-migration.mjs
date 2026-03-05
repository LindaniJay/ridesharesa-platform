import { loadEnvFiles } from './load-env.mjs';
import { PrismaClient } from '@prisma/client';

// Load environment variables
loadEnvFiles();

const prisma = new PrismaClient();

async function main() {
  console.log('Applying migration: add paymentReference column...');
  
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
    `);
    console.log('✓ Added paymentReference column');
    
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Booking_paymentReference_key" ON "Booking"("paymentReference");
    `);
    console.log('✓ Created unique index on paymentReference');
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Booking_paymentReference_idx" ON "Booking"("paymentReference");
    `);
    console.log('✓ Created index on paymentReference');
    
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
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
