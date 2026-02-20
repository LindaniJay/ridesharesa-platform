import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function safeExtFromFileName(name: string) {
  const ext = (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "bin";
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { dbUser } = await requireUser();
  const viewerRole = dbUser.role;
  const viewerId = dbUser.id;

  const { id: bookingId } = await context.params;

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Expected multipart/form-data");

  const file = form.get("proof");
  if (!(file instanceof File) || file.size <= 0) return badRequest("Missing proof file");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      renterId: true,
      status: true,
      stripeCheckoutSessionId: true,
      listing: { select: { hostId: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const isAdmin = viewerRole === "ADMIN";
  const isRenter = viewerRole === "RENTER" && booking.renterId === viewerId;
  const isHost = viewerRole === "HOST" && booking.listing.hostId === viewerId;

  // Payment proof should not be uploaded by hosts.
  if (!isAdmin && !isRenter) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isPending = booking.status === "PENDING_PAYMENT";
  const isManual = isPending && !booking.stripeCheckoutSessionId;
  if (!isManual) {
    return NextResponse.json({ error: "Payment proof is only allowed for pending manual/EFT bookings" }, { status: 400 });
  }

  const allowedTypes = new Set(["application/pdf"]);
  const isImage = file.type.startsWith("image/");
  const isPdf = allowedTypes.has(file.type);
  if (!isImage && !isPdf) {
    return badRequest("Only images or PDF proofs are supported");
  }

  const maxBytes = 8 * 1024 * 1024;
  if (file.size > maxBytes) {
    return badRequest("File too large (max 8MB)");
  }

  const bucket = process.env.SUPABASE_BOOKING_PHOTOS_BUCKET || "booking-photos";

  try {
    const random = crypto.randomUUID();
    const ext = safeExtFromFileName(file.name);
    const path = `${bookingId}/payment_proof/${random}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const admin = supabaseAdmin();
    const { error } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (error) {
      throw new Error(error.message);
    }

    const url = new URL(req.url);
    const redirectTo = `/bookings/${encodeURIComponent(bookingId)}?paymentProof=uploaded`;
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
