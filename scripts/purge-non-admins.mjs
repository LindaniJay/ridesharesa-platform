import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

function usageAndExit(code = 1) {
  console.error("Usage:");
  console.error("  node scripts/purge-non-admins.mjs [--apply] [--keep <email>]...");
  console.error("\nExamples:");
  console.error("  node scripts/purge-non-admins.mjs --keep a@b.com --keep c@d.com");
  console.error("  node scripts/purge-non-admins.mjs --apply --keep a@b.com --keep c@d.com");
  console.error("\nEnv required:");
  console.error("  DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(code);
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");

const keepEmails = [];
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === "--keep") {
    const raw = args[i + 1];
    if (!raw) usageAndExit(1);
    keepEmails.push(String(raw).toLowerCase().trim());
    i += 1;
    continue;
  }
  if (a === "--apply") continue;
  if (a.startsWith("--")) continue;
}

const explicitKeep = new Set(keepEmails.filter(Boolean));

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasRealServiceRoleKey =
  Boolean(serviceRoleKey) &&
  serviceRoleKey !== "replace_me" &&
  !/^replace_/i.test(serviceRoleKey ?? "") &&
  /^eyJ/i.test(serviceRoleKey ?? "");

if (!databaseUrl || !supabaseUrl || !serviceRoleKey || !hasRealServiceRoleKey) {
  console.error("Missing/invalid env. Need DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role).");
  process.exit(2);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listAllAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (page < 200) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`supabase listUsers failed: ${error.message}`);
    const batch = data?.users ?? [];
    if (batch.length === 0) break;
    users.push(...batch);
    page += 1;
  }
  return users;
}

function isAuthAdminUser(u) {
  const appRole = u?.app_metadata?.role;
  return appRole === "ADMIN";
}

function safeEmail(u) {
  return String(u?.email ?? "").toLowerCase().trim();
}

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  // 1) Compute keep set from DB + Supabase + explicit keep list
  const prismaAdmins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  const prismaAdminEmails = new Set(prismaAdmins.map((u) => u.email.toLowerCase().trim()).filter(Boolean));

  const authUsers = await listAllAuthUsers();
  const authAdminEmails = new Set(authUsers.filter(isAuthAdminUser).map(safeEmail).filter(Boolean));

  const keep = new Set([...explicitKeep, ...prismaAdminEmails, ...authAdminEmails]);

  // 2) Ensure explicit keep emails are admins (without resetting password)
  if (explicitKeep.size > 0) {
    for (const email of explicitKeep) {
      const match = authUsers.find((u) => safeEmail(u) === email);
      if (match?.id) {
        if (!isAuthAdminUser(match)) {
          if (!apply) {
            console.log(`[dry-run] would set Supabase app_metadata.role=ADMIN: ${email}`);
          } else {
            const { error } = await supabase.auth.admin.updateUserById(match.id, {
              app_metadata: { ...(match.app_metadata || {}), role: "ADMIN" },
            });
            if (error) throw new Error(`supabase updateUserById failed for ${email}: ${error.message}`);
            console.log(`[supabase] promoted to ADMIN: ${email}`);
          }
        }
      }

      const dbMatch = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } }).catch(() => null);
      if (dbMatch && dbMatch.role !== "ADMIN") {
        if (!apply) {
          console.log(`[dry-run] would set Prisma user role=ADMIN: ${email}`);
        } else {
          await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
          console.log(`[db] promoted to ADMIN: ${email}`);
        }
      }
    }
  }

  // Recompute keep after promotions.
  const authUsers2 = await listAllAuthUsers();
  const authAdminEmails2 = new Set(authUsers2.filter(isAuthAdminUser).map(safeEmail).filter(Boolean));
  const prismaAdmins2 = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  const prismaAdminEmails2 = new Set(prismaAdmins2.map((u) => u.email.toLowerCase().trim()).filter(Boolean));
  const keep2 = new Set([...explicitKeep, ...authAdminEmails2, ...prismaAdminEmails2]);

  // 3) Delete non-admins from Prisma
  const dbNonAdmins = await prisma.user.findMany({
    where: {
      role: { not: "ADMIN" },
      email: { notIn: Array.from(keep2) },
    },
    select: { email: true, role: true },
    take: 5000,
  });

  console.log(`[db] non-admin users to delete: ${dbNonAdmins.length}`);
  if (!apply) {
    for (const u of dbNonAdmins.slice(0, 25)) console.log(`  - ${u.email} (${u.role})`);
    if (dbNonAdmins.length > 25) console.log(`  ... and ${dbNonAdmins.length - 25} more`);
  } else {
    const deleted = await prisma.user.deleteMany({
      where: {
        role: { not: "ADMIN" },
        email: { notIn: Array.from(keep2) },
      },
    });
    console.log(`[db] deleted: ${deleted.count}`);
  }

  // 4) Delete non-admins from Supabase Auth
  const authNonAdmins = authUsers2.filter((u) => {
    const email = safeEmail(u);
    if (!email) return false;
    if (keep2.has(email)) return false;
    if (isAuthAdminUser(u)) return false;
    return true;
  });

  console.log(`[supabase] non-admin auth users to delete: ${authNonAdmins.length}`);
  if (!apply) {
    for (const u of authNonAdmins.slice(0, 25)) console.log(`  - ${safeEmail(u)}`);
    if (authNonAdmins.length > 25) console.log(`  ... and ${authNonAdmins.length - 25} more`);
  } else {
    for (const u of authNonAdmins) {
      const { error } = await supabase.auth.admin.deleteUser(u.id);
      if (error) throw new Error(`supabase deleteUser failed for ${safeEmail(u)}: ${error.message}`);
    }
    console.log(`[supabase] deleted: ${authNonAdmins.length}`);
  }

  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply to delete.");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
