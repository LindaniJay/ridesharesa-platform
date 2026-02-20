import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatMoney(amountCents: number, currency: string) {
  const c = currency || "ZAR";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: c,
      maximumFractionDigits: 0,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(0)} ${c}`;
  }
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { dbUser } = await requireUser();
  const viewerId = dbUser.id;
  const viewerRole = dbUser.role;

  const { id: bookingId } = await context.params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      currency: true,
      totalCents: true,
      paidAt: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
      startDate: true,
      endDate: true,
      days: true,
      renterId: true,
      renter: { select: { email: true } },
      listing: {
        select: {
          title: true,
          dailyRateCents: true,
          hostId: true,
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const isAdmin = viewerRole === "ADMIN";
  const isRenter = viewerRole === "RENTER" && booking.renterId === viewerId;
  const isHost = viewerRole === "HOST" && booking.listing.hostId === viewerId;
  if (!isAdmin && !isRenter) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const paymentMethod = booking.stripeCheckoutSessionId ? "Card (Stripe)" : "Instant EFT (manual)";
  const paymentReference = booking.stripePaymentIntentId
    ? booking.stripePaymentIntentId
    : booking.stripeCheckoutSessionId
      ? booking.stripeCheckoutSessionId
      : `RS-${booking.id}`;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const marginX = 48;
  let y = 800;

  function drawText(text: string, opts?: { bold?: boolean; size?: number; color?: { r: number; g: number; b: number } }) {
    const size = opts?.size ?? 12;
    const color = opts?.color ?? { r: 0.1, g: 0.1, b: 0.1 };
    page.drawText(text, {
      x: marginX,
      y,
      size,
      font: opts?.bold ? fontBold : font,
      color: rgb(color.r, color.g, color.b),
    });
    y -= size + 6;
  }

  drawText("RideShareSA", { bold: true, size: 18 });
  drawText("Booking receipt", { bold: true, size: 14, color: { r: 0.2, g: 0.2, b: 0.2 } });
  y -= 6;

  drawText(`Receipt generated: ${new Date().toLocaleString("en-ZA")}`, { size: 10, color: { r: 0.35, g: 0.35, b: 0.35 } });
  y -= 10;

  drawText(`Booking ID: ${booking.id}`, { bold: true });
  drawText(`Listing: ${booking.listing.title}`);
  drawText(`Renter: ${booking.renter.email}`);
  y -= 6;

  drawText(`Start date: ${formatDate(booking.startDate)}`);
  drawText(`End date: ${formatDate(booking.endDate)}`);
  drawText(`Days: ${booking.days}`);
  drawText(`Daily rate: ${formatMoney(booking.listing.dailyRateCents, booking.currency)}`);
  y -= 6;

  drawText(`Total: ${formatMoney(booking.totalCents, booking.currency)}`, { bold: true });
  drawText(`Status: ${booking.status}`);
  drawText(`Paid at: ${booking.paidAt ? booking.paidAt.toLocaleString("en-ZA") : "—"}`);
  y -= 6;

  drawText(`Payment method: ${paymentMethod}`);
  drawText(`Payment reference: ${paymentReference}`);
  y -= 12;

  drawText("Notes", { bold: true });
  drawText("- Keep this receipt for your records.", { size: 10, color: { r: 0.35, g: 0.35, b: 0.35 } });
  drawText("- For Instant EFT, the reference is required to match payment.", { size: 10, color: { r: 0.35, g: 0.35, b: 0.35 } });

  const bytes = await pdf.save();
  const fileName = `booking-${booking.id}-receipt.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename=\"${fileName}\"`,
      "cache-control": "no-store",
    },
  });
}
