import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { supabaseServer } from "@/app/lib/supabase/server";

const allowDevWithoutDb = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_WITHOUT_DB !== "0";

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

  let existing: { email: string; role: "ADMIN" | "HOST" | "RENTER"; status: string } | null;
  try {
    existing = await prisma.user.findUnique({
      where: { email },
      select: { email: true, role: true, status: true },
    });
  } catch (e) {
    if (allowDevWithoutDb) {
      return NextResponse.json({
        user: {
          email,
          role: desiredRole ?? "RENTER",
        },
        ok: true,
        degraded: true,
        reason: "DB_UNREACHABLE",
        message: e instanceof Error ? e.message : String(e),
      });
    }
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        user: null,
        ok: false,
        reason: "DB_UNREACHABLE",
        message: e instanceof Error ? e.message : String(e),
      });
    }
    return NextResponse.json({ user: null }, { status: 503 });
  }

  const select = { email: true, role: true, status: true } as const;

  let dbUser: { email: string; role: "ADMIN" | "HOST" | "RENTER"; status: string };

  try {
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
      } else if (
        (desiredRole === "HOST" || desiredRole === "RENTER") &&
        existing.role !== "ADMIN" &&
        existing.role !== desiredRole
      ) {
        update.role = desiredRole;
      }

      dbUser = Object.keys(update).length
        ? await prisma.user.update({ where: { email }, data: update, select })
        : existing;
    }
  } catch (e) {
    if (allowDevWithoutDb) {
      return NextResponse.json({
        user: {
          email,
          role: desiredRole ?? "RENTER",
        },
        ok: true,
        degraded: true,
        reason: "DB_UNREACHABLE",
        message: e instanceof Error ? e.message : String(e),
      });
    }
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        user: null,
        ok: false,
        reason: "DB_UNREACHABLE",
        message: e instanceof Error ? e.message : String(e),
      });
    }
    return NextResponse.json({ user: null }, { status: 503 });
  }

  if (dbUser.status === "SUSPENDED") {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: { email: dbUser.email, role: dbUser.role } });
}
