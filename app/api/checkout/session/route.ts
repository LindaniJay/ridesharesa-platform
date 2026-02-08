import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { stripe } from "@/app/lib/stripe";
import { requireRole } from "@/app/lib/require";

const BodySchema = z.object({
  listingId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) ? days : 0;
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
    select: { id: true, title: true, dailyRateCents: true, currency: true },
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

  const totalCents = days * listing.dailyRateCents;

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
    },
    select: { id: true },
  });

  const baseUrl = process.env.APP_URL || "http://localhost:3000";

  const stripeSession = await stripe().checkout.sessions.create({
    mode: "payment",
    metadata: {
      bookingId: booking.id,
      listingId: listing.id,
      renterId,
    },
    line_items: [
      {
        quantity: days,
        price_data: {
          currency: listing.currency.toLowerCase(),
          unit_amount: listing.dailyRateCents,
          product_data: {
            name: listing.title,
            description: `Car booking (${days} day${days === 1 ? "" : "s"})`,
          },
        },
      },
    ],
    success_url: `${baseUrl}/bookings/${booking.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout/${listing.id}?checkout=cancelled`,
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { stripeCheckoutSessionId: stripeSession.id },
  });

  if (!stripeSession.url) {
    return NextResponse.json({ error: "Stripe checkout URL missing" }, { status: 500 });
  }

  return NextResponse.json({ url: stripeSession.url });
}
