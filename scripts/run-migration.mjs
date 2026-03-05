import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Read the migration SQL file
const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '20260304_add_payment_reference', 'migration.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

console.log('Migration SQL to execute:');
console.log(migrationSQL);
console.log('\nExecuting migration...\n');

try {
  // Use psql from the command line if available
  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set in environment');
    process.exit(1);
  }

  // Execute using psql
  execSync(`echo "${migrationSQL.replace(/"/g, '\\"')}" | psql "${dbUrl}"`, {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: '' },
  });

  console.log('\n✅ Migration executed successfully!');
} catch (error: any) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
