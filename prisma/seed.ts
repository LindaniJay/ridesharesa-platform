import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@rideshare.local").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD ?? "Admin123!";
  const name = (process.env.ADMIN_NAME ?? "Admin").trim() || "Admin";

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role: "ADMIN",
    },
    update: {
      role: "ADMIN",
      name,
    },
  });

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const hasRealServiceRoleKey =
    Boolean(serviceRoleKey) &&
    serviceRoleKey !== "replace_me" &&
    !/^replace_/i.test(serviceRoleKey ?? "") &&
    /^eyJ/i.test(serviceRoleKey ?? "");

  if (url && serviceRoleKey && hasRealServiceRoleKey) {
    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error && !/already\s*registered|exists/i.test(error.message)) {
      throw new Error(`Supabase admin.createUser failed: ${error.message}`);
    }
  } else {
    console.log(
      "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set (or still placeholder); skipped creating Supabase Auth admin user.",
    );
  }

  console.log("Seeded admin user:");
  console.log(`  email: ${email}`);
  console.log(`  name: ${name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
