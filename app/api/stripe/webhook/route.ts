import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  STRIPE_RELEASE_EVENT_TYPES,
  STRIPE_SUCCESS_EVENT_TYPES,
  nextBookingStatusForStripeEvent,
} from "@/app/lib/bookings";
import { prisma } from "@/app/lib/prisma";
import { stripe } from "@/app/lib/stripe";

async function findBookingForSession(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId;

  if (bookingId) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true },
    });
  }

  return prisma.booking.findFirst({
    where: { stripeCheckoutSessionId: session.id },
    select: { id: true, status: true },
  });
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const type = event.type;
  const nextStatus = nextBookingStatusForStripeEvent(type);

  if (nextStatus && (STRIPE_SUCCESS_EVENT_TYPES.has(type) || STRIPE_RELEASE_EVENT_TYPES.has(type))) {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;

    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    const booking = await findBookingForSession(session);

    if (booking) {
      if (nextStatus === "PENDING_APPROVAL") {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: nextStatus,
            paidAt: new Date(),
            stripeCheckoutSessionId: sessionId,
            stripePaymentIntentId: paymentIntent,
          },
        });
      }

      if (nextStatus === "CANCELLED") {
        await prisma.booking.updateMany({
          where: {
            id: booking.id,
            status: { in: ["PENDING_PAYMENT", "PENDING_APPROVAL"] },
          },
          data: {
            status: nextStatus,
            paidAt: null,
            stripeCheckoutSessionId: sessionId,
            stripePaymentIntentId: paymentIntent,
          },
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
