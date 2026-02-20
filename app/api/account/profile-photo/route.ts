import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { supabaseServer } from "@/app/lib/supabase/server";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized(message = "Not authenticated") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function safeExtFromFileName(name: string) {
  const ext = (name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "jpg";
}

async function ensureBucketExists(bucket: string) {
  const client = supabaseAdmin();
  try {
    const { data, error } = await client.storage.listBuckets();
    const exists = !error && (data ?? []).some((b) => b.name === bucket);
    if (exists) return;

    await client.storage.createBucket(bucket, { public: false }).catch(() => null);
  } catch {
    // Ignore bucket introspection/creation failures; upload will return a useful error.
  }
}

async function uploadImageWithRetry(params: {
  bucket: string;
  path: string;
  bytes: Uint8Array;
  contentType: string;
  upsert: boolean;
}) {
  const client = supabaseAdmin();

  const attempt = async () =>
    client.storage.from(params.bucket).upload(params.path, params.bytes, {
      contentType: params.contentType,
      upsert: params.upsert,
    });

  const first = await attempt();
  if (!first.error) return first;

  const msg = first.error.message.toLowerCase();
  if (msg.includes("bucket") || msg.includes("not found") || msg.includes("404")) {
    await ensureBucketExists(params.bucket);
    const second = await attempt();
    return second;
  }

  return first;
}

type RoleLiteral = "ADMIN" | "HOST" | "RENTER";

function roleFromSupabaseUser(user: { app_metadata?: any; user_metadata?: any }): RoleLiteral {
  const appRole = user?.app_metadata?.role;
  if (appRole === "ADMIN") return "ADMIN";

  const metadataRole = user?.user_metadata?.role;
  if (metadataRole === "HOST") return "HOST";
  if (metadataRole === "RENTER") return "RENTER";

  return "RENTER";
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return unauthorized();

  const email = data.user.email ? normalizeEmail(data.user.email) : null;
  if (!email) return unauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Expected multipart/form-data");

  const profilePhoto = form.get("profilePhoto") ?? form.get("file") ?? form.get("avatar");
  if (!(profilePhoto instanceof File)) return badRequest("Missing profilePhoto");
  if (!profilePhoto.type.startsWith("image/")) return badRequest("Only image uploads are supported");

  const maxBytes = 8 * 1024 * 1024;
  if (profilePhoto.size > maxBytes) {
    const mb = (profilePhoto.size / (1024 * 1024)).toFixed(2);
    return badRequest(`Image too large (max 8MB). Yours is ${mb}MB.`);
  }

  const dbUser = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: (typeof data.user.user_metadata?.name === "string" && data.user.user_metadata.name.trim()) || null,
      role: roleFromSupabaseUser(data.user),
      status: "ACTIVE",
      idVerificationStatus: "UNVERIFIED",
      driversLicenseStatus: "UNVERIFIED",
    },
    update: {},
    select: { id: true },
  });

  const bucket = process.env.SUPABASE_USER_DOCS_BUCKET || "user-documents";
  await ensureBucketExists(bucket);
  const ext = safeExtFromFileName(profilePhoto.name);
  const path = `${dbUser.id}/profile.${ext}`;

  const bytes = new Uint8Array(await profilePhoto.arrayBuffer());
  const { error: uploadError } = await uploadImageWithRetry({
    bucket,
    path,
    bytes,
    contentType: profilePhoto.type,
    upsert: true,
  });

  if (uploadError) {
    return NextResponse.json(
      {
        error:
          uploadError.message +
          (uploadError.message.toLowerCase().includes("bucket") || uploadError.message.toLowerCase().includes("not found")
            ? ` (Ensure Supabase Storage bucket "${bucket}" exists and service role key is set.)`
            : ""),
      },
      { status: 400 },
    );
  }

  const client = supabaseAdmin();
  await client.auth.admin.updateUserById(data.user.id, {
    user_metadata: {
      ...data.user.user_metadata,
      profileImagePath: path,
      profileImageUpdatedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true });
}
