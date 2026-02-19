import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

type Kind = "licenseDisk" | "registration" | "licenseCard";

function isKind(value: string): value is Kind {
  return value === "licenseDisk" || value === "registration" || value === "licenseCard";
}

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

export async function GET(
  req: Request,
  context: { params: Promise<{ kind: string }> },
) {
  await requireRole("ADMIN");

  const { kind } = await context.params;
  if (!isKind(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId")?.trim();
  if (!listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      licenseDiskImageUrl: true,
      registrationImageUrl: true,
      licenseCardImageUrl: true,
    },
  });

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const stored =
    kind === "licenseDisk"
      ? listing.licenseDiskImageUrl
      : kind === "registration"
        ? listing.registrationImageUrl
        : listing.licenseCardImageUrl;

  if (!stored) {
    return NextResponse.json({ error: "Document not uploaded" }, { status: 404 });
  }

  // Legacy: documents were stored as public URLs.
  if (isHttpUrl(stored)) {
    return NextResponse.redirect(stored);
  }

  const bucket = process.env.SUPABASE_LISTING_DOCS_BUCKET || "listing-documents";
  const admin = supabaseAdmin();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(stored, 60 * 5);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          `Could not create signed URL (ensure bucket "${bucket}" exists and SUPABASE_SERVICE_ROLE_KEY is set).`,
        bucket,
        path: stored,
      },
      { status: 400 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
