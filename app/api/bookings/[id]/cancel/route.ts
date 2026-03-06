import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";

const CANCELLABLE_STATUSES = new Set(["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED"] as const);

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { dbUser } = await requireUser();
  if (dbUser.role !== "RENTER") {
    return NextResponse.json({ error: "Only renters can cancel their bookings" }, { status: 403 });
  }

  const { id: bookingId } = await context.params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      renterId: true,
      status: true,
      endDate: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.renterId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (booking.status === "CANCELLED") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  if (!CANCELLABLE_STATUSES.has(booking.status)) {
    return NextResponse.json({ error: "This booking cannot be cancelled in its current state" }, { status: 400 });
  }

  if (booking.endDate <= new Date()) {
    return NextResponse.json({ error: "This booking has already ended and cannot be cancelled" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    }),
    prisma.bookingMessage.create({
      data: {
        bookingId: booking.id,
        senderId: dbUser.id,
        recipientRole: "HOST",
        body: "BOOKING UPDATE: Renter cancelled this booking.",
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
