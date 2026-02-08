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
  role?: Role | null;
}) {
  return prisma.user.upsert({
    where: { email: params.email },
    create: {
      email: params.email,
      name: params.name ?? null,
      role: params.role ?? "RENTER",
      status: "ACTIVE",
      idVerificationStatus: "UNVERIFIED",
      driversLicenseStatus: "UNVERIFIED",
    },
    update: {
      // Only fill name if missing.
      ...(params.name ? { name: params.name } : {}),

      // Allow promoting to ADMIN only from server-controlled sources.
      ...(params.role === "ADMIN" ? { role: "ADMIN" } : {}),
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

  // ADMIN is only allowed from server-controlled app_metadata.
  // (Supabase Auth app_metadata can only be written via service role.)
  const appRoleRaw = data.user.app_metadata?.role;
  const appRole = appRoleRaw === "ADMIN" ? "ADMIN" : null;

  // Only allow HOST/RENTER to be sourced from user metadata.
  // Never grant ADMIN via client-controlled metadata.
  const metadataRoleRaw = data.user.user_metadata?.role;
  const metadataRole = metadataRoleRaw === "HOST" || metadataRoleRaw === "RENTER" ? metadataRoleRaw : null;

  const dbUser = await getOrCreateDbUser({
    email,
    name,
    role: appRole ?? metadataRole,
  });

  if (dbUser.status === "SUSPENDED") redirect("/");
  return { supabaseUser: data.user, dbUser };
}

export async function requireRole(requiredRole: Role): Promise<AuthedUser> {
  const authed = await requireUser();
  if (authed.dbUser.role !== requiredRole) redirect("/");
  return authed;
}
