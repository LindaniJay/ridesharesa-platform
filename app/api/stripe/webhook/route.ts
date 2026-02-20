import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/app/lib/prisma";
import { stripe } from "@/app/lib/stripe";

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

  if (
    type === "checkout.session.completed" ||
    type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    const bookingId = session.metadata?.bookingId;

    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    const bookingSelect = {
      id: true,
      status: true,
      currency: true,
      totalCents: true,
      renter: { select: { email: true, name: true } },
      listing: { select: { title: true, city: true } },
    } as const;

    const booking = bookingId
      ? await prisma.booking.findUnique({ where: { id: bookingId }, select: bookingSelect })
      : await prisma.booking.findFirst({ where: { stripeCheckoutSessionId: sessionId }, select: bookingSelect });

    if (booking) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "PENDING_APPROVAL",
          paidAt: new Date(),
          stripeCheckoutSessionId: sessionId,
          stripePaymentIntentId: paymentIntent,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
