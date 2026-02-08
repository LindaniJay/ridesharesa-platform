import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/app/lib/prisma";
import { resend } from "@/app/lib/resend";
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
          status: "CONFIRMED",
          paidAt: new Date(),
          stripeCheckoutSessionId: sessionId,
          stripePaymentIntentId: paymentIntent,
        },
      });

      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM;
      const appUrl = process.env.APP_URL || "http://localhost:3000";

      if (apiKey && from) {
        try {
          const renterName = booking.renter.name || "there";
          await resend().emails.send({
            from,
            to: booking.renter.email,
            subject: `Booking confirmed: ${booking.listing.title}`,
            html: `
              <div style="font-family: ui-sans-serif, system-ui; line-height: 1.4">
                <h2>Booking confirmed</h2>
                <p>Hi ${renterName},</p>
                <p>Your booking is confirmed for <b>${booking.listing.title}</b> (${booking.listing.city}).</p>
                <p>Total: <b>${(booking.totalCents / 100).toFixed(0)} ${booking.currency}</b></p>
                <p><a href="${appUrl}/bookings/${booking.id}">View booking</a></p>
              </div>
            `,
          });
        } catch {
          // Email failures should not fail the webhook
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
