import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const promoCode = String(formData.get("promoCode") ?? "").trim();

  if (!bookingId || !promoCode) {
    return NextResponse.json({ ok: false, error: "Missing booking or promo code." }, { status: 400 });
  }

  // Example: simple promo code logic
  const validCodes: { [key: string]: number } = { "SAVE10": 0.10, "SAVE20": 0.20 };
  const discount = validCodes[promoCode.toUpperCase()] ?? 0;

  if (discount <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid promo code." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    return NextResponse.json({ ok: false, error: "Booking not found." }, { status: 404 });
  }

  const newTotal = Math.round(booking.totalCents * (1 - discount));
  await prisma.booking.update({
    where: { id: bookingId },
    data: { totalCents: newTotal },
  });

  return NextResponse.json({ ok: true, discount, newTotal });
}
