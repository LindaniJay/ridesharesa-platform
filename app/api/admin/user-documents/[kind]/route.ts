import { NextResponse } from "next/server";

import { requireRole } from "@/app/lib/require";
import { prisma } from "@/app/lib/prisma";
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

async function resolvePathFromStorage(params: {
  bucket: string;
  userId: string;
  kind: Kind;
}) {
  const admin = supabaseAdmin();
  const { data, error } = await admin.storage.from(params.bucket).list(params.userId, {
    limit: 100,
    offset: 0,
  });
  if (error) throw new Error(error.message);

  const objects = data ?? [];
  const match = objects.find((o) => typeof o.name === "string" && o.name.startsWith(`${params.kind}.`));
  if (!match) return null;
  return `${params.userId}/${match.name}`;
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
  const userIdRaw = url.searchParams.get("userId")?.trim() || null;
  const emailRaw = url.searchParams.get("email")?.trim() || null;
  if (!userIdRaw && !emailRaw) {
    return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
  }

  const email = emailRaw ? normalizeEmail(emailRaw) : null;

  const bucket = process.env.SUPABASE_USER_DOCS_BUCKET || "user-documents";

  try {
    // Prefer Prisma user id (matches how documents are stored: <prismaUserId>/<kind>.<ext>)
    const dbUser = userIdRaw
      ? await prisma.user.findUnique({ where: { id: userIdRaw }, select: { id: true, email: true } })
      : email
        ? await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })
        : null;

    // Best-effort: read stored metadata path from Supabase Auth.
    // Not strictly required (we can list the Storage folder by Prisma user id).
    const supabaseUser = email ? await findSupabaseUserByEmail(email).catch(() => null) : null;
    const metadata = (supabaseUser?.user_metadata ?? {}) as Record<string, unknown>;
    const metadataPath =
      kindRaw === "profile"
        ? (metadata.profileImagePath as string | undefined)
        : kindRaw === "id"
          ? (metadata.idDocumentImagePath as string | undefined)
          : (metadata.driversLicenseImagePath as string | undefined);

    const candidatePaths: string[] = [];
    if (typeof metadataPath === "string" && metadataPath.trim()) {
      candidatePaths.push(metadataPath);
    }

    if (dbUser?.id) {
      const storagePath = await resolvePathFromStorage({ bucket, userId: dbUser.id, kind: kindRaw });
      if (storagePath) candidatePaths.push(storagePath);
    }

    const path = candidatePaths.find((p) => typeof p === "string" && p.length > 0) || null;
    if (!path) {
      return NextResponse.json(
        {
          error:
            "No document found for this user. If the user uploaded docs, ensure SUPABASE_SERVICE_ROLE_KEY is set and the bucket exists.",
          hints: {
            expectedBucket: bucket,
            expectedPathPattern: dbUser?.id ? `${dbUser.id}/${kindRaw}.*` : undefined,
          },
        },
        { status: 404 },
      );
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        {
          error:
            error?.message ||
            `Could not create signed URL (ensure bucket "${bucket}" exists and SUPABASE_SERVICE_ROLE_KEY is set).`,
          path,
        },
        { status: 400 },
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch document";
    return NextResponse.json(
      {
        error: message,
        hints: {
          requiredEnv: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
          bucket,
        },
      },
      { status: 500 },
    );
  }
}
