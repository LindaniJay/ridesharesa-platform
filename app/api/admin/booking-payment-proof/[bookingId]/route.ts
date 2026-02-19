import { NextResponse } from "next/server";

import { requireRole } from "@/app/lib/require";
import { prisma } from "@/app/lib/prisma";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function GET(req: Request, context: { params: Promise<{ bookingId: string }> }) {
  await requireRole("ADMIN");

  const { bookingId } = await context.params;
  const id = String(bookingId ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const bucket = process.env.SUPABASE_BOOKING_PHOTOS_BUCKET || "booking-photos";
  const folder = `${booking.id}/payment_proof`;

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin.storage.from(bucket).list(folder, {
      limit: 20,
      offset: 0,
      sortBy: { column: "name", order: "desc" },
    });

    if (error) {
      return NextResponse.json({ error: error.message, bucket, folder }, { status: 400 });
    }

    const objects = data ?? [];
    const first = objects.find((o) => typeof o.name === "string" && o.name.length > 0);
    if (!first?.name) {
      return NextResponse.json({ error: "No payment proof uploaded" }, { status: 404 });
    }

    const path = `${folder}/${first.name}`;
    const { data: signedData, error: signedError } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 5);
    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        {
          error:
            signedError?.message ||
            `Could not create signed URL (ensure bucket "${bucket}" exists and SUPABASE_SERVICE_ROLE_KEY is set).`,
          path,
        },
        { status: 400 },
      );
    }

    return NextResponse.redirect(signedData.signedUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch payment proof";
    const url = new URL(req.url);
    return NextResponse.json(
      {
        error: message,
        hints: {
          requiredEnv: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
          bucket,
          bookingId: booking.id,
        },
        requestId: url.searchParams.get("requestId") || undefined,
      },
      { status: 500 },
    );
  }
}
