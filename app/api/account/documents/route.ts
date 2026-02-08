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

async function uploadImage(params: {
  bucket: string;
  userId: string;
  key: "profile" | "id" | "license";
  file: File;
}) {
  if (!params.file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported");
  }

  const maxBytes = 5 * 1024 * 1024;
  if (params.file.size > maxBytes) {
    throw new Error("Image too large (max 5MB)");
  }

  const ext = safeExtFromFileName(params.file.name);
  const path = `${params.userId}/${params.key}.${ext}`;

  const bytes = new Uint8Array(await params.file.arrayBuffer());
  const client = supabaseAdmin();

  const { error } = await client.storage.from(params.bucket).upload(path, bytes, {
    contentType: params.file.type,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { path };
}

export async function POST(req: Request) {
  // Authenticate via Supabase SSR cookies
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return unauthorized();

  const email = data.user.email ? normalizeEmail(data.user.email) : null;
  if (!email) return unauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Expected multipart/form-data");

  const profilePhoto = form.get("profilePhoto");
  const idDocument = form.get("idDocument");
  const driversLicense = form.get("driversLicense");

  if (!(profilePhoto instanceof File)) return badRequest("Missing profilePhoto");
  if (!(idDocument instanceof File)) return badRequest("Missing idDocument");
  if (!(driversLicense instanceof File)) return badRequest("Missing driversLicense");

  const dbUser = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name:
        (typeof data.user.user_metadata?.name === "string" && data.user.user_metadata.name.trim()) ||
        null,
      role: data.user.user_metadata?.role === "HOST" ? "HOST" : "RENTER",
      status: "ACTIVE",
      idVerificationStatus: "UNVERIFIED",
      driversLicenseStatus: "UNVERIFIED",
    },
    update: {},
    select: { id: true },
  });

  const bucket = process.env.SUPABASE_USER_DOCS_BUCKET || "user-documents";

  try {
    const [profile, idDoc, license] = await Promise.all([
      uploadImage({ bucket, userId: dbUser.id, key: "profile", file: profilePhoto }),
      uploadImage({ bucket, userId: dbUser.id, key: "id", file: idDocument }),
      uploadImage({ bucket, userId: dbUser.id, key: "license", file: driversLicense }),
    ]);

    // Store paths in Supabase Auth metadata (keeps Prisma schema unchanged)
    await supabaseAdmin().auth.admin.updateUserById(data.user.id, {
      user_metadata: {
        ...data.user.user_metadata,
        profileImagePath: profile.path,
        idDocumentImagePath: idDoc.path,
        driversLicenseImagePath: license.path,
        documentsUploadedAt: new Date().toISOString(),
      },
    });

    // Mark verification as pending now that documents exist
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        idVerificationStatus: "PENDING",
        driversLicenseStatus: "PENDING",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    // Common: bucket doesn't exist or is not accessible
    return NextResponse.json(
      {
        error:
          message +
          (message.toLowerCase().includes("bucket") || message.toLowerCase().includes("not found")
            ? ` (Ensure Supabase Storage bucket "${bucket}" exists and service role key is set.)`
            : ""),
      },
      { status: 400 },
    );
  }
}
