import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { supabaseServer } from "@/app/lib/supabase/server";

const BodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    role: z.enum(["RENTER", "HOST"]).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  let data: Awaited<ReturnType<(typeof supabase.auth)["getUser"]>>["data"];
  let error: Awaited<ReturnType<(typeof supabase.auth)["getUser"]>>["error"];
  try {
    ({ data, error } = await supabase.auth.getUser());
  } catch {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: false, reason: "SUPABASE_UNREACHABLE" });
    }
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        ok: false,
        reason: "SUPABASE_ERROR",
        name: (error as { name?: unknown }).name,
        message: (error as { message?: unknown }).message,
      });
    }
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = data.user;
  const email = user?.email?.toLowerCase().trim();
  if (!email) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: false, reason: "NOT_AUTHENTICATED" });
    }
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const requestedName = parsed.data.name ?? null;
  const requestedRole = parsed.data.role;

  const metadataRoleRaw = (user?.user_metadata as { role?: unknown } | null | undefined)?.role;
  const metadataRole = metadataRoleRaw === "HOST" || metadataRoleRaw === "RENTER" ? metadataRoleRaw : null;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, name: true },
  });

  if (existing) {
    // Do not allow changing role via bootstrap.
    // Fill name if missing.
    if (!existing.name && requestedName) {
      await prisma.user.update({ where: { email }, data: { name: requestedName } });
    }

    // If a user chose HOST at signup but the DB row already exists as RENTER
    // (e.g. created earlier by a background sync), allow a one-way promotion.
    if (existing.role === "RENTER" && requestedRole === "HOST" && metadataRole === "HOST") {
      await prisma.user.update({ where: { email }, data: { role: "HOST" } });
    }

    return NextResponse.json({ ok: true });
  }

  await prisma.user.create({
    data: {
      email,
      name: requestedName,
      role: requestedRole ?? "RENTER",
      status: "ACTIVE",
      idVerificationStatus: "UNVERIFIED",
      driversLicenseStatus: "UNVERIFIED",
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
