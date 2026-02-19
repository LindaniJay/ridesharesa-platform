import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

const rawEmail = process.argv[2];
if (!rawEmail) {
  console.error("Usage: node scripts/delete-user.mjs <email>");
  process.exit(1);
}

const email = rawEmail.toLowerCase().trim();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const deleted = await prisma.user.deleteMany({ where: { email } });
  console.log(`[db] Deleted users: ${deleted.count} (${email})`);
} finally {
  await prisma.$disconnect();
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasRealServiceRoleKey =
  Boolean(serviceRoleKey) &&
  serviceRoleKey !== "replace_me" &&
  !/^replace_/i.test(serviceRoleKey ?? "") &&
  /^eyJ/i.test(serviceRoleKey ?? "");

if (!url || !serviceRoleKey || !hasRealServiceRoleKey) {
  console.log("[supabase] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set (or placeholder); skipped deleting auth user.");
  process.exit(0);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let foundId = null;
let page = 1;
const perPage = 200;

while (page < 50) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
  if (error) {
    if (/invalid\s*api\s*key/i.test(error.message)) {
      console.log("[supabase] Service role key appears invalid; skipped deleting auth user.");
      process.exit(0);
    }
    console.error(`[supabase] listUsers failed: ${error.message}`);
    process.exitCode = 1;
    break;
  }

  const users = data?.users ?? [];
  if (users.length === 0) break;

  const match = users.find((u) => (u.email ?? "").toLowerCase().trim() === email);
  if (match?.id) {
    foundId = match.id;
    break;
  }

  page += 1;
}

if (!foundId) {
  console.log(`[supabase] No auth user found for ${email}`);
  process.exit(0);
}

const { error: delError } = await supabase.auth.admin.deleteUser(foundId);
if (delError) {
  console.error(`[supabase] deleteUser failed: ${delError.message}`);
  process.exitCode = 1;
} else {
  console.log(`[supabase] Deleted auth user: ${email}`);
}
