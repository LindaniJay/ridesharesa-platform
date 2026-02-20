import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type SeedRole = "ADMIN" | "HOST" | "RENTER";

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

async function ensureSupabaseAuthUser(params: {
  // Supabase client is a generic factory; avoid `ReturnType<typeof createClient>`
  // because it can collapse generics to `never` during TS builds (e.g. Vercel).
  supabase: SupabaseClient<any, any, any, any, any>;
  email: string;
  password: string;
  role: SeedRole;
  user_metadata: Record<string, unknown>;
}) {
  const email = normalizeEmail(params.email);

  const { error } = await params.supabase.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: params.user_metadata,
    app_metadata: { role: params.role },
  });

  if (!error) return;

  const alreadyExists = /already/i.test(error.message) && /(registered|exists)/i.test(error.message);
  if (!alreadyExists) {
    if (/invalid\s*api\s*key/i.test(error.message)) {
      throw new Error("Supabase service role key appears invalid.");
    }
    throw new Error(`Supabase admin.createUser failed for ${email}: ${error.message}`);
  }

  let existingId: string | null = null;
  let page = 1;
  const perPage = 200;

  while (page < 50 && !existingId) {
    const { data, error: listError } = await params.supabase.auth.admin.listUsers({ page, perPage });
    if (listError) throw new Error(`Supabase admin.listUsers failed: ${listError.message}`);

    const users = data?.users ?? [];
    if (users.length === 0) break;

    const match = users.find((u) => normalizeEmail(u.email ?? "") === email);
    if (match?.id) existingId = match.id;
    page += 1;
  }

  if (!existingId) {
    throw new Error(`Supabase Auth user exists but could not be found via listUsers: ${email}`);
  }

  const { error: updateError } = await params.supabase.auth.admin.updateUserById(existingId, {
    password: params.password,
    user_metadata: params.user_metadata,
    app_metadata: { role: params.role },
  });

  if (updateError) {
    throw new Error(`Supabase admin.updateUserById failed for ${email}: ${updateError.message}`);
  }
}

async function main() {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL ?? "admin@rideshare.local");
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!";
  const adminName = (process.env.ADMIN_NAME ?? "Admin").trim() || "Admin";

  const hostEmail = normalizeEmail(process.env.SEED_HOST_EMAIL ?? "host@rideshare.local");
  const hostPassword = process.env.SEED_HOST_PASSWORD ?? "Host123!";
  const hostName = (process.env.SEED_HOST_NAME ?? "Test Host").trim() || "Test Host";

  const renterEmail = normalizeEmail(process.env.SEED_RENTER_EMAIL ?? "renter@rideshare.local");
  const renterPassword = process.env.SEED_RENTER_PASSWORD ?? "Renter123!";
  const renterName = (process.env.SEED_RENTER_NAME ?? "Test Renter").trim() || "Test Renter";

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: adminName, role: "ADMIN" },
    update: { role: "ADMIN", name: adminName },
    select: { id: true, email: true },
  });

  const hostUser = await prisma.user.upsert({
    where: { email: hostEmail },
    create: { email: hostEmail, name: hostName, role: "HOST" },
    update: { role: "HOST", name: hostName },
    select: { id: true, email: true },
  });

  const renterUser = await prisma.user.upsert({
    where: { email: renterEmail },
    create: { email: renterEmail, name: renterName, role: "RENTER" },
    update: { role: "RENTER", name: renterName },
    select: { id: true, email: true },
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

    await ensureSupabaseAuthUser({
      supabase,
      email: adminEmail,
      password: adminPassword,
      role: "ADMIN",
      user_metadata: { name: adminName },
    });

    await ensureSupabaseAuthUser({
      supabase,
      email: hostEmail,
      password: hostPassword,
      role: "HOST",
      user_metadata: { name: hostName },
    });

    await ensureSupabaseAuthUser({
      supabase,
      email: renterEmail,
      password: renterPassword,
      role: "RENTER",
      user_metadata: { name: renterName },
    });
  } else {
    console.log(
      "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set (or still placeholder); skipped creating Supabase Auth admin user.",
    );
  }

  // Seed a few vehicles for the host
  const sampleListings = [
    {
      title: "Toyota Corolla (Automatic)",
      description: "Comfortable city car, great on fuel.",
      city: "Cape Town",
      latitude: -33.9249,
      longitude: 18.4241,
      dailyRateCents: 55000,
    },
    {
      title: "VW Polo Vivo",
      description: "Reliable hatchback, perfect for daily errands.",
      city: "Johannesburg",
      latitude: -26.2041,
      longitude: 28.0473,
      dailyRateCents: 48000,
    },
    {
      title: "Hyundai i20",
      description: "Easy to drive, clean interior.",
      city: "Durban",
      latitude: -29.8587,
      longitude: 31.0218,
      dailyRateCents: 50000,
    },
  ];

  const createdListings = [] as Array<{ id: string; title: string; city: string }>;
  for (const l of sampleListings) {
    const existing = await prisma.listing.findFirst({
      where: { hostId: hostUser.id, title: l.title },
      select: { id: true },
    });

    const data = {
      hostId: hostUser.id,
      title: l.title,
      description: l.description,
      city: l.city,
      country: "South Africa",
      latitude: l.latitude,
      longitude: l.longitude,
      dailyRateCents: l.dailyRateCents,
      currency: "ZAR",
      status: "ACTIVE" as const,
      isApproved: true,
    };

    const saved = existing
      ? await prisma.listing.update({ where: { id: existing.id }, data, select: { id: true, title: true, city: true } })
      : await prisma.listing.create({ data, select: { id: true, title: true, city: true } });

    createdListings.push(saved);
  }

  console.log("Seeded users:");
  console.log(`  ADMIN  email: ${adminEmail}  password: ${adminPassword}`);
  console.log(`  HOST   email: ${hostEmail}  password: ${hostPassword}`);
  console.log(`  RENTER email: ${renterEmail}  password: ${renterPassword}`);
  console.log("\nSeeded host vehicles:");
  for (const l of createdListings) {
    console.log(`  - ${l.title} (${l.city}) id=${l.id}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
