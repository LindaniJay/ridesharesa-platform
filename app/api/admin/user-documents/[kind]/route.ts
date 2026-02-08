import { NextResponse } from "next/server";

import { requireRole } from "@/app/lib/require";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

type Kind = "profile" | "id" | "license";

function isKind(value: string): value is Kind {
  return value === "profile" || value === "id" || value === "license";
}

async function findSupabaseUserByEmail(email: string) {
  const admin = supabaseAdmin();
  const perPage = 200;

  // Best-effort scan. For typical admin usage (small user counts) this is fine.
  // Avoid unbounded scans.
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const users = data?.users ?? [];
    const found = users.find((u) => normalizeEmail(u.email || "") === email);
    if (found) return found;

    if (users.length < perPage) break;
  }

  return null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ kind: string }> },
) {
  await requireRole("ADMIN");

  const { kind: kindRaw } = await context.params;
  if (!isKind(kindRaw)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const url = new URL(req.url);
  const emailRaw = url.searchParams.get("email");
  if (!emailRaw) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const email = normalizeEmail(emailRaw);
  const supabaseUser = await findSupabaseUserByEmail(email);
  if (!supabaseUser) {
    return NextResponse.json({ error: "User not found in Supabase Auth" }, { status: 404 });
  }

  const bucket = process.env.SUPABASE_USER_DOCS_BUCKET || "user-documents";

  const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;
  const path =
    kindRaw === "profile"
      ? (metadata.profileImagePath as string | undefined)
      : kindRaw === "id"
        ? (metadata.idDocumentImagePath as string | undefined)
        : (metadata.driversLicenseImagePath as string | undefined);

  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "No document uploaded for this user" }, { status: 404 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 5);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          `Could not create signed URL (ensure bucket \"${bucket}\" exists and is accessible).`,
      },
      { status: 400 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
