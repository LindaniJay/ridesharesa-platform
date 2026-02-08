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

  const email = data.user?.email?.toLowerCase().trim();
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
