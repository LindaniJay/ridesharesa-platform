import { redirect } from "next/navigation";
import type { Role, UserStatus, VerificationStatus } from "@prisma/client";

import type { User as SupabaseUser } from "@supabase/supabase-js";

import { prisma } from "@/app/lib/prisma";
import { supabaseServer } from "@/app/lib/supabase/server";

export type AuthedUser = {
  supabaseUser: SupabaseUser;
  dbUser: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    status: UserStatus;
    idVerificationStatus: VerificationStatus;
    driversLicenseStatus: VerificationStatus;
  };
};

async function getOrCreateDbUser(params: {
  email: string;
  name?: string | null;
  role?: "HOST" | "RENTER" | null;
}) {
  return prisma.user.upsert({
    where: { email: params.email },
    create: {
      email: params.email,
      name: params.name ?? null,
      role: params.role === "HOST" ? "HOST" : "RENTER",
      status: "ACTIVE",
      idVerificationStatus: "UNVERIFIED",
      driversLicenseStatus: "UNVERIFIED",
    },
    update: {
      // Only fill name if missing.
      ...(params.name ? { name: params.name } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      idVerificationStatus: true,
      driversLicenseStatus: true,
    },
  });
}

export async function requireUser(): Promise<AuthedUser> {
  const supabase = await supabaseServer();
  let data: Awaited<ReturnType<(typeof supabase.auth)["getUser"]>>["data"];
  let error: Awaited<ReturnType<(typeof supabase.auth)["getUser"]>>["error"];
  try {
    ({ data, error } = await supabase.auth.getUser());
  } catch {
    redirect("/sign-in");
  }

  if (error || !data.user) redirect("/sign-in");

  const email = data.user.email?.toLowerCase().trim();
  if (!email) redirect("/sign-in");

  const name =
    (typeof data.user.user_metadata?.name === "string" && data.user.user_metadata.name.trim()) ||
    null;

  // Only allow HOST/RENTER to be sourced from user metadata.
  // Never grant ADMIN via client-controlled metadata.
  const metadataRoleRaw = data.user.user_metadata?.role;
  const metadataRole = metadataRoleRaw === "HOST" || metadataRoleRaw === "RENTER" ? metadataRoleRaw : null;

  const dbUser = await getOrCreateDbUser({ email, name, role: metadataRole });

  if (dbUser.status === "SUSPENDED") redirect("/");
  return { supabaseUser: data.user, dbUser };
}

export async function requireRole(requiredRole: Role): Promise<AuthedUser> {
  const authed = await requireUser();
  if (authed.dbUser.role !== requiredRole) redirect("/");
  return authed;
}
