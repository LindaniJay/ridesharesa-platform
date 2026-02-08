import { NextResponse } from "next/server";
import { z } from "zod";

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

function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) ? days : 0;
}

const CHAUFFEUR_RATE_CENTS_PER_KM = 10 * 100;

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

  const chauffeurEnabled = parsed.data.chauffeur?.enabled === true;
  const chauffeurKm = chauffeurEnabled ? parsed.data.chauffeur?.kilometers ?? 0 : 0;
  if (chauffeurEnabled && chauffeurKm <= 0) {
    return NextResponse.json({ error: "Invalid chauffeur kilometers" }, { status: 400 });
  }

  const baseCents = days * listing.dailyRateCents;
  const chauffeurCents = chauffeurEnabled && chauffeurKm > 0 ? chauffeurKm * CHAUFFEUR_RATE_CENTS_PER_KM : 0;
  const totalCents = baseCents + chauffeurCents;

  const booking = await prisma.booking.create({
    data: {
      listingId: listing.id,
      renterId,
      startDate: start,
      endDate: end,
      days,
      totalCents,
      currency: listing.currency,
      status: "PENDING_PAYMENT",
      // Note: no Stripe fields set; this is a manual/EFT payment flow.
    },
    select: { id: true },
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
