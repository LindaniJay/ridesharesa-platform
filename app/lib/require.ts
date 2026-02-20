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
    surname: string | null;
    role: Role;
    status: UserStatus;
    idVerificationStatus: VerificationStatus;
    driversLicenseStatus: VerificationStatus;
  };
};

async function getOrCreateDbUser(params: {
  email: string;
  name?: string | null;
  surname?: string | null;
  role?: Role | null;
}) {
  const select = {
    id: true,
    email: true,
    name: true,
    surname: true,
    role: true,
    status: true,
    idVerificationStatus: true,
    driversLicenseStatus: true,
  } as const;

  const existing = await prisma.user.findUnique({ where: { email: params.email }, select });

  if (!existing) {
    return prisma.user.create({
      data: {
        email: params.email,
        name: params.name ?? null,
        surname: params.surname ?? null,
        role: params.role ?? "RENTER",
        status: "ACTIVE",
        idVerificationStatus: "UNVERIFIED",
        driversLicenseStatus: "UNVERIFIED",
      },
      select,
    });
  }

  const update: Partial<{ name: string | null; surname: string | null; role: Role }> = {};

  // Only fill name if missing.
  if (!existing.name && params.name) update.name = params.name;
  if (!existing.surname && params.surname) update.surname = params.surname;

  // Role rules:
  // - Never grant ADMIN from client-controlled metadata.
  // - Allow syncing HOST/RENTER from Supabase metadata to avoid users getting
  //   stuck as RENTER if the DB row was created earlier.
  if (params.role === "ADMIN") {
    update.role = "ADMIN";
  } else if ((params.role === "HOST" || params.role === "RENTER") && existing.role !== "ADMIN") {
    if (existing.role !== params.role) update.role = params.role;
  }

  if (Object.keys(update).length === 0) return existing;

  return prisma.user.update({ where: { email: params.email }, data: update, select });
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

  const surname =
    (typeof data.user.user_metadata?.surname === "string" && data.user.user_metadata.surname.trim()) ||
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
    surname,
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
