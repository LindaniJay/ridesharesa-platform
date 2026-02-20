import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

const rawArgs = process.argv.slice(2);
if (rawArgs.length === 0) {
  console.error("Usage:");
  console.error("  node scripts/grant-admins.mjs <email1> <email2> ...");
  console.error("  node scripts/grant-admins.mjs <email1=password1> <email2=password2> ...");
  console.error("");
  console.error("Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL");
  console.error("Password options:");
  console.error("  - ADMIN_INITIAL_PASSWORD (same password for all)");
  console.error("  - ADMIN_INITIAL_PASSWORD_BASE (sequential: base + N)");
  console.error("    optional: ADMIN_INITIAL_PASSWORD_START (default 1)");
  process.exit(1);
}

function parseEmailPasswordArg(arg) {
  const raw = String(arg || "").trim();
  if (!raw) return null;
  const eq = raw.indexOf("=");
  if (eq <= 0) {
    return { email: raw.toLowerCase().trim(), password: null };
  }
  const email = raw.slice(0, eq).toLowerCase().trim();
  const password = raw.slice(eq + 1).trim();
  return { email, password: password || null };
}

const parsedItems = rawArgs
  .map(parseEmailPasswordArg)
  .filter(Boolean)
  .filter((x) => x.email);

// De-dup by email, preserving first occurrence (so ordering/password choice is deterministic).
const items = [];
const seen = new Set();
for (const it of parsedItems) {
  if (seen.has(it.email)) continue;
  seen.add(it.email);
  items.push(it);
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const samePassword = process.env.ADMIN_INITIAL_PASSWORD;
const passwordBase = process.env.ADMIN_INITIAL_PASSWORD_BASE;
const passwordStartRaw = process.env.ADMIN_INITIAL_PASSWORD_START;
const passwordStart = Number.isFinite(Number(passwordStartRaw)) ? Math.max(1, Math.floor(Number(passwordStartRaw))) : 1;

const hasRealServiceRoleKey =
  Boolean(serviceRoleKey) &&
  serviceRoleKey !== "replace_me" &&
  !/^replace_/i.test(serviceRoleKey ?? "") &&
  /^eyJ/i.test(serviceRoleKey ?? "");

if (!url || !serviceRoleKey || !hasRealServiceRoleKey) {
  console.error("Missing/invalid SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (service role).");
  process.exit(2);
}

function resolvePasswordForIndex(i) {
  const explicit = items[i]?.password;
  if (explicit) return explicit;
  if (passwordBase && passwordBase.trim()) return `${passwordBase}${passwordStart + i}`;
  if (samePassword && samePassword.trim()) return samePassword;
  return null;
}

for (let i = 0; i < items.length; i += 1) {
  const pw = resolvePasswordForIndex(i);
  if (!pw || pw.trim().length < 8) {
    console.error(`Missing/invalid password for ${items[i].email}.`);
    console.error("Provide one of:");
    console.error("  - email=password as an argument");
    console.error("  - ADMIN_INITIAL_PASSWORD_BASE (sequential passwords)");
    console.error("  - ADMIN_INITIAL_PASSWORD (same password for all)");
    process.exit(2);
  }
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmail(email) {
  let page = 1;
  const perPage = 200;

  while (page < 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);

    const users = data?.users ?? [];
    if (users.length === 0) break;

    const match = users.find((u) => (u.email ?? "").toLowerCase().trim() === email);
    if (match?.id) return match.id;
    page += 1;
  }

  return null;
}

async function ensureAdminAuthUser(email, password) {
  let userId = await findUserIdByEmail(email);

  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (created.error) {
      throw new Error(`createUser failed for ${email}: ${created.error.message}`);
    }

    userId = created.data?.user?.id ?? null;
    if (!userId) throw new Error(`createUser returned no user id for ${email}`);
    console.log(`[supabase] created auth user: ${email}`);
  }

  const current = await supabase.auth.admin.getUserById(userId);
  if (current.error) {
    throw new Error(`getUserById failed for ${email}: ${current.error.message}`);
  }

  const existingAppMeta = current.data?.user?.app_metadata && typeof current.data.user.app_metadata === "object"
    ? current.data.user.app_metadata
    : {};

  const update = await supabase.auth.admin.updateUserById(userId, {
    password,
    app_metadata: { ...existingAppMeta, role: "ADMIN" },
  });
  if (update.error) {
    throw new Error(`updateUserById failed for ${email}: ${update.error.message}`);
  }

  console.log(`[supabase] set app_metadata.role=ADMIN and password: ${email}`);
  return userId;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  for (let i = 0; i < items.length; i += 1) {
    const email = items[i].email;
    const password = resolvePasswordForIndex(i);
    await ensureAdminAuthUser(email, password);

    await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN" },
      create: {
        email,
        role: "ADMIN",
        status: "ACTIVE",
        idVerificationStatus: "UNVERIFIED",
        driversLicenseStatus: "UNVERIFIED",
      },
      select: { id: true },
    });

    console.log(`[db] upserted user role=ADMIN: ${email}`);
  }

  console.log("Done.");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
