import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { dbUser } = await requireUser();
  if (dbUser.role !== "RENTER") {
    return NextResponse.json({ error: "Only renters can submit payment proof" }, { status: 403 });
  }

  const { id: bookingId } = await context.params;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      renterId: true,
      status: true,
      stripeCheckoutSessionId: true,
      paymentReference: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.renterId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (booking.status !== "PENDING_PAYMENT" || booking.stripeCheckoutSessionId) {
    return NextResponse.json({ error: "This booking is not eligible for manual proof submission" }, { status: 400 });
  }

  const bucket = process.env.SUPABASE_BOOKING_PHOTOS_BUCKET || "booking-photos";
  const folder = `${booking.id}/payment_proof`;
  const { data, error } = await supabaseAdmin().storage.from(bucket).list(folder, {
    limit: 1,
    offset: 0,
    sortBy: { column: "name", order: "desc" },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Upload payment proof before submitting for approval" }, { status: 400 });
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "PENDING_APPROVAL",
      paidAt: new Date(),
    },
  });

  await prisma.bookingMessage.create({
    data: {
      bookingId: booking.id,
      senderId: dbUser.id,
      recipientRole: "ADMIN",
      body: `PAYMENT PROOF SUBMITTED: Renter uploaded EFT proof and submitted booking ${booking.paymentReference || booking.id} for admin approval.`,
    },
  });

  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/bookings/${encodeURIComponent(booking.id)}?paymentProof=submitted`, url.origin));
}
