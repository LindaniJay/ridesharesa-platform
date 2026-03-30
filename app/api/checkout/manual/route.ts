import { NextResponse } from "next/server";
import { z } from "zod";

import {
  RESERVED_BOOKING_STATUSES,
  calculateBookingTotalCents,
  daysBetween,
  generatePaymentReferenceCode,
  isPaymentReferenceConflict,
} from "@/app/lib/bookings";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";

const BodySchema = z.object({
  listingId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  chauffeur: z
    .object({
      enabled: z.boolean(),
      kilometers: z.number().int().min(0).max(5000),
    })
    .optional(),
});

async function createManualBooking(params: {
  listingId: string;
  renterId: string;
  startDate: Date;
  endDate: Date;
  days: number;
  totalCents: number;
  currency: string;
}) {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.booking.create({
        data: {
          listingId: params.listingId,
          renterId: params.renterId,
          paymentReference: generatePaymentReferenceCode(),
          startDate: params.startDate,
          endDate: params.endDate,
          days: params.days,
          totalCents: params.totalCents,
          currency: params.currency,
          status: "PENDING_PAYMENT",
        },
        select: { id: true },
      });
    } catch (error) {
      if (attempt === maxAttempts || !isPaymentReferenceConflict(error)) {
        throw error;
      }
    }
  }

  throw new Error("Unable to allocate a unique payment reference");
}

export async function POST(req: Request) {
  const { dbUser } = await requireRole("RENTER");
  const renterId = dbUser.id;

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { listingId, startDate: startRaw, endDate: endRaw } = parsed.data;

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: "ACTIVE", isApproved: true },
    select: { id: true, dailyRateCents: true, currency: true },
  });

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }

  const days = daysBetween(start, end);
  if (days <= 0 || days > 30) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const conflict = await prisma.booking.findFirst({
    where: {
      listingId: listing.id,
      status: { in: RESERVED_BOOKING_STATUSES },
      startDate: { lt: end },
      endDate: { gt: start },
    },
    select: { id: true },
  });

  if (conflict) {
    return NextResponse.json({ error: "This vehicle is not available for the selected dates." }, { status: 409 });
  }

  const chauffeurEnabled = parsed.data.chauffeur?.enabled === true;
  const chauffeurKm = chauffeurEnabled ? parsed.data.chauffeur?.kilometers ?? 0 : 0;
  if (chauffeurEnabled && chauffeurKm <= 0) {
    return NextResponse.json({ error: "Invalid chauffeur kilometers" }, { status: 400 });
  }

  const { totalCents } = calculateBookingTotalCents({
    days,
    dailyRateCents: listing.dailyRateCents,
    chauffeurEnabled,
    chauffeurKm,
  });

  const booking = await createManualBooking({
    listingId: listing.id,
    renterId,
    startDate: start,
    endDate: end,
    days,
    totalCents,
    currency: listing.currency,
  });

  const breakdownParams = new URLSearchParams();
  if (chauffeurEnabled && chauffeurKm > 0) {
    breakdownParams.set("chauffeurKm", String(chauffeurKm));
    breakdownParams.set("chauffeurRate", "10");
  }
  const breakdownQuery = breakdownParams.toString();
  const breakdownSuffix = breakdownQuery ? `?${breakdownQuery}` : "";

  return NextResponse.json({
    bookingId: booking.id,
    url: `/bookings/${booking.id}${breakdownSuffix}`,
  });
}
