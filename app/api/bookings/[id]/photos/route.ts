import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";
import { supabaseAdmin, uploadPrivateImage } from "@/app/lib/supabaseAdmin";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function safeExtFromFileName(name: string) {
  const ext = (name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "jpg";
}

type Kind = "host_handover" | "renter_pickup" | "renter_return" | "host_return";

function isKind(value: string): value is Kind {
  return (
    value === "host_handover" ||
    value === "renter_pickup" ||
    value === "renter_return" ||
    value === "host_return"
  );
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { dbUser } = await requireUser();
  const viewerRole = dbUser.role;
  const viewerId = dbUser.id;

  const { id: bookingId } = await context.params;

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Expected multipart/form-data");

  const kindRaw = String(form.get("kind") ?? "").trim();
  if (!isKind(kindRaw)) return badRequest("Invalid kind");

  const file = form.get("photo");
  if (!(file instanceof File) || file.size <= 0) return badRequest("Missing photo");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      renterId: true,
      listing: { select: { hostId: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const isAdmin = viewerRole === "ADMIN";
  const isRenter = viewerRole === "RENTER" && booking.renterId === viewerId;
  const isHost = viewerRole === "HOST" && booking.listing.hostId === viewerId;

  if (!isAdmin && !isRenter && !isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Enforce which role can upload which kind
  if (!isAdmin) {
    if ((kindRaw === "host_handover" || kindRaw === "host_return") && !isHost) {
      return NextResponse.json({ error: "Only the host can upload this photo type" }, { status: 403 });
    }
    if ((kindRaw === "renter_pickup" || kindRaw === "renter_return") && !isRenter) {
      return NextResponse.json({ error: "Only the renter can upload this photo type" }, { status: 403 });
    }
  }

  const bucket = process.env.SUPABASE_BOOKING_PHOTOS_BUCKET || "booking-photos";

  try {
    // Create a short random suffix for uniqueness
    const random = crypto.randomUUID();
    const ext = safeExtFromFileName(file.name);
    const path = `${bookingId}/${kindRaw}/${random}.${ext}`;

    await uploadPrivateImage({ bucket, path, file, upsert: false });

    // Best-effort: add some metadata to Auth for audit (doesn't store paths per-file)
    // Not required for functionality.
    try {
      const admin = supabaseAdmin();
      const now = new Date().toISOString();
      // No-op: we don't have the supabase auth user id for db users here reliably.
      // Leaving as future enhancement.
      void now;
      void admin;
    } catch {
      // ignore
    }

    const url = new URL(req.url);
    const redirectTo = `/bookings/${encodeURIComponent(bookingId)}?photos=uploaded`;
    return NextResponse.redirect(new URL(redirectTo, url.origin));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
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
