import { loadEnvFiles } from "./load-env";

loadEnvFiles();

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
      description: "Comfortable city car, great on fuel. This reliable sedan features automatic transmission, air conditioning, Bluetooth connectivity, and a spacious interior perfect for families or business trips. Recently serviced with all safety features checked.",
      city: "Cape Town",
      latitude: -33.9249,
      longitude: 18.4241,
      dailyRateCents: 55000,
      imageUrl: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80",
      licenseDiskImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
      registrationImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      licenseCardImageUrl: "https://images.unsplash.com/photo-1589395937921-7c502a2ac62e?w=400&q=80",
    },
    {
      title: "VW Polo Vivo",
      description: "Reliable hatchback, perfect for daily errands. Economical fuel consumption, easy parking with compact size, power steering, and central locking. Ideal for city driving and navigating tight spaces. Well-maintained with recent tire replacement.",
      city: "Johannesburg",
      latitude: -26.2041,
      longitude: 28.0473,
      dailyRateCents: 48000,
      imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80",
      licenseDiskImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
      registrationImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      licenseCardImageUrl: "https://images.unsplash.com/photo-1589395937921-7c502a2ac62e?w=400&q=80",
    },
    {
      title: "Hyundai i20",
      description: "Easy to drive, clean interior. Modern hatchback with excellent visibility, comfortable seating for 5 passengers, USB charging ports, and a responsive entertainment system. Perfect for both city commutes and weekend getaways.",
      city: "Durban",
      latitude: -29.8587,
      longitude: 31.0218,
      dailyRateCents: 50000,
      imageUrl: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800&q=80",
      licenseDiskImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
      registrationImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      licenseCardImageUrl: "https://images.unsplash.com/photo-1589395937921-7c502a2ac62e?w=400&q=80",
    },
    {
      title: "BMW 3 Series (Luxury)",
      description: "Premium sedan for business or leisure. Leather seats, navigation system, premium sound, sunroof, and advanced safety features. Automatic transmission with sport mode. Perfect for making a great impression or enjoying a comfortable long-distance drive.",
      city: "Cape Town",
      latitude: -33.9321,
      longitude: 18.4280,
      dailyRateCents: 125000,
      imageUrl: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
      licenseDiskImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
      registrationImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      licenseCardImageUrl: "https://images.unsplash.com/photo-1589395937921-7c502a2ac62e?w=400&q=80",
    },
    {
      title: "Ford Ranger 4x4 (Bakkie)",
      description: "Powerful double cab bakkie, ideal for adventure or moving cargo. 4x4 capability, air conditioning, tonneau cover, and plenty of load space. Great for outdoor trips, beach days, or transporting large items. Excellent road presence and safety.",
      city: "Johannesburg",
      latitude: -26.1950,
      longitude: 28.0340,
      dailyRateCents: 95000,
      imageUrl: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",
      licenseDiskImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
      registrationImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      licenseCardImageUrl: "https://images.unsplash.com/photo-1589395937921-7c502a2ac62e?w=400&q=80",
    },
    {
      title: "Mercedes-Benz C-Class",
      description: "Elegant and sophisticated luxury sedan. Premium interior with ambient lighting, heated seats, advanced infotainment system, and smooth automatic transmission. Ideal for special occasions, business meetings, or treating yourself to a premium driving experience.",
      city: "Pretoria",
      latitude: -25.7479,
      longitude: 28.2293,
      dailyRateCents: 140000,
      imageUrl: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80",
      licenseDiskImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
      registrationImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      licenseCardImageUrl: "https://images.unsplash.com/photo-1589395937921-7c502a2ac62e?w=400&q=80",
    },
    {
      title: "Nissan NP200 (Budget Bakkie)",
      description: "Affordable and practical small bakkie for deliveries and light cargo. Easy to drive, economical on fuel, and perfect for small business needs. Clean load bin and reliable engine. Great for moving furniture, appliances, or running a small delivery service.",
      city: "Durban",
      latitude: -29.8467,
      longitude: 31.0094,
      dailyRateCents: 42000,
      imageUrl: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80",
      licenseDiskImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
      registrationImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      licenseCardImageUrl: "https://images.unsplash.com/photo-1589395937921-7c502a2ac62e?w=400&q=80",
    },
    {
      title: "Honda Jazz (Spacious Hatchback)",
      description: "Surprisingly spacious hatchback with Honda's Magic Seats for flexible cargo space. Fuel-efficient, reliable, with great visibility and comfortable ride quality. Perfect for families, students, or anyone needing versatility. Excellent safety ratings.",
      city: "Port Elizabeth",
      latitude: -33.9608,
      longitude: 25.6022,
      dailyRateCents: 52000,
      imageUrl: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&q=80",
      licenseDiskImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
      registrationImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      licenseCardImageUrl: "https://images.unsplash.com/photo-1589395937921-7c502a2ac62e?w=400&q=80",
    },
    {
      title: "Audi A4 (Premium Sport)",
      description: "Sporty luxury sedan with Quattro all-wheel drive. Dynamic handling, powerful engine, premium Bang & Olufsen sound system, and sophisticated design. Features include adaptive cruise control, lane assist, and a virtual cockpit. For discerning drivers who appreciate performance.",
      city: "Cape Town",
      latitude: -33.9188,
      longitude: 18.4233,
      dailyRateCents: 135000,
      imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80",
      licenseDiskImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
      registrationImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      licenseCardImageUrl: "https://images.unsplash.com/photo-1589395937921-7c502a2ac62e?w=400&q=80",
    },
    {
      title: "Toyota Fortuner 4x4 (Family SUV)",
      description: "7-seater family SUV perfect for road trips and adventures. 4x4 capability, spacious interior, third-row seating, roof rails, and excellent ground clearance. Ideal for family holidays, transporting groups, or exploring off-road destinations. Strong and reliable.",
      city: "Johannesburg",
      latitude: -26.2089,
      longitude: 28.0486,
      dailyRateCents: 110000,
      imageUrl: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80",
      licenseDiskImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
      registrationImageUrl: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      licenseCardImageUrl: "https://images.unsplash.com/photo-1589395937921-7c502a2ac62e?w=400&q=80",
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
      imageUrl: l.imageUrl,
      licenseDiskImageUrl: l.licenseDiskImageUrl,
      registrationImageUrl: l.registrationImageUrl,
      licenseCardImageUrl: l.licenseCardImageUrl,
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
