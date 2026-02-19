import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

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

    if (error) {
      const alreadyExists = /already/i.test(error.message) && /(registered|exists)/i.test(error.message);

      if (alreadyExists) {
        let existingId: string | null = null;
        let page = 1;
        const perPage = 200;

        while (page < 50 && !existingId) {
          const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
          if (listError) {
            throw new Error(`Supabase admin.listUsers failed: ${listError.message}`);
          }

          const users = data?.users ?? [];
          if (users.length === 0) break;

          const match = users.find((u) => (u.email ?? "").toLowerCase().trim() === email);
          if (match?.id) existingId = match.id;
          page += 1;
        }

        if (!existingId) {
          throw new Error("Supabase Auth admin user exists but could not be found via listUsers");
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(existingId, {
          password,
          user_metadata: { name },
        });

        if (updateError) {
          throw new Error(`Supabase admin.updateUserById failed: ${updateError.message}`);
        }
      } else if (/invalid\s*api\s*key/i.test(error.message)) {
        console.log(
          "Supabase service role key appears invalid; skipped creating Supabase Auth admin user. (You can sign up via /sign-up instead.)",
        );
      } else {
        throw new Error(`Supabase admin.createUser failed: ${error.message}`);
      }
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
