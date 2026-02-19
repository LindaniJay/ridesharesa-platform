import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { supabaseServer } from "@/app/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  let data: Awaited<ReturnType<(typeof supabase.auth)["getUser"]>>["data"];
  try {
    ({ data } = await supabase.auth.getUser());
  } catch {
    return NextResponse.json({ user: null });
  }

  if (!data.user?.email) {
    return NextResponse.json({ user: null });
  }

  const email = data.user.email.toLowerCase().trim();

  // ADMIN is only allowed from server-controlled app_metadata.
  const appRoleRaw = data.user.app_metadata?.role;
  const appRole = appRoleRaw === "ADMIN" ? "ADMIN" : null;

  // Only allow HOST/RENTER from metadata. Never grant ADMIN via metadata.
  const metadataRoleRaw = data.user.user_metadata?.role;
  const metadataRole = metadataRoleRaw === "HOST" || metadataRoleRaw === "RENTER" ? metadataRoleRaw : null;

  const desiredRole = appRole ?? metadataRole;

  const existing = await prisma.user.findUnique({ where: { email }, select: { email: true, role: true, status: true } });

  const select = { email: true, role: true, status: true } as const;

  let dbUser: { email: string; role: "ADMIN" | "HOST" | "RENTER"; status: string };

  if (!existing) {
    dbUser = await prisma.user.create({
      data: {
        email,
        role: desiredRole === "HOST" || desiredRole === "ADMIN" ? desiredRole : "RENTER",
        status: "ACTIVE",
        idVerificationStatus: "UNVERIFIED",
        driversLicenseStatus: "UNVERIFIED",
      },
      select,
    });
  } else {
    const update: Partial<{ role: "ADMIN" | "HOST" | "RENTER" }> = {};
    if (desiredRole === "ADMIN") {
      update.role = "ADMIN";
    } else if ((desiredRole === "HOST" || desiredRole === "RENTER") && existing.role !== "ADMIN" && existing.role !== desiredRole) {
      update.role = desiredRole;
    }

    dbUser = Object.keys(update).length
      ? await prisma.user.update({ where: { email }, data: update, select })
      : existing;
  }

  if (dbUser.status === "SUSPENDED") {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: { email: dbUser.email, role: dbUser.role } });
}
