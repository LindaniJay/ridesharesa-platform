import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
  const pageWidth = page.getWidth();
  const headerHeight = 118;
  const bodyTop = page.getHeight() - headerHeight - 24;

  const palette = {
    bgDark: rgb(0.04, 0.08, 0.16),
    bgAccent: rgb(0.0, 0.56, 0.27),
    textMain: rgb(0.1, 0.1, 0.12),
    textMuted: rgb(0.42, 0.45, 0.5),
    border: rgb(0.86, 0.88, 0.92),
    card: rgb(0.985, 0.99, 1),
  };

  function drawLabelValue(params: {
    x: number;
    y: number;
    label: string;
    value: string;
    valueBold?: boolean;
    align?: "left" | "right";
    width?: number;
  }) {
    const align = params.align ?? "left";
    const width = params.width ?? 220;
    page.drawText(params.label, {
      x: params.x,
      y: params.y,
      size: 9,
      font,
      color: palette.textMuted,
    });

    const valueFont = params.valueBold ? fontBold : font;
    const valueSize = 11;
    const textWidth = valueFont.widthOfTextAtSize(params.value, valueSize);
    page.drawText(params.value, {
      x: align === "right" ? params.x + width - textWidth : params.x,
      y: params.y - 14,
      size: valueSize,
      font: valueFont,
      color: palette.textMain,
    });
  }

  page.drawRectangle({
    x: 0,
    y: page.getHeight() - headerHeight,
    width: pageWidth,
    height: headerHeight,
    color: palette.bgDark,
  });

  page.drawRectangle({
    x: pageWidth - 220,
    y: page.getHeight() - headerHeight,
    width: 220,
    height: headerHeight,
    color: palette.bgAccent,
    opacity: 0.22,
  });

  let logoDrawn = false;
  try {
    const logoPath = join(process.cwd(), "public", "rideshare-logo.png");
    const logoBytes = await readFile(logoPath);
    const logoImage = await pdf.embedPng(logoBytes);
    page.drawImage(logoImage, {
      x: marginX,
      y: page.getHeight() - 88,
      width: 44,
      height: 44,
    });
    logoDrawn = true;
  } catch {
    logoDrawn = false;
  }

  page.drawText("RideShare SA", {
    x: marginX + (logoDrawn ? 54 : 0),
    y: page.getHeight() - 64,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Booking Receipt", {
    x: marginX + (logoDrawn ? 54 : 0),
    y: page.getHeight() - 84,
    size: 11,
    font,
    color: rgb(0.9, 0.93, 0.97),
  });

  const generatedAt = new Date().toLocaleString("en-ZA");
  const receiptNumber = `RS-${booking.id.slice(0, 10).toUpperCase()}`;

  page.drawText(`Receipt #: ${receiptNumber}`, {
    x: pageWidth - marginX - 205,
    y: page.getHeight() - 62,
    size: 10,
    font: fontBold,
    color: rgb(0.95, 0.98, 1),
  });
  page.drawText(`Generated: ${generatedAt}`, {
    x: pageWidth - marginX - 205,
    y: page.getHeight() - 81,
    size: 9,
    font,
    color: rgb(0.87, 0.92, 0.97),
  });

  page.drawRectangle({
    x: marginX,
    y: bodyTop - 128,
    width: pageWidth - marginX * 2,
    height: 128,
    borderColor: palette.border,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  page.drawText("Booking Summary", {
    x: marginX + 14,
    y: bodyTop - 22,
    size: 12,
    font: fontBold,
    color: palette.textMain,
  });

  drawLabelValue({ x: marginX + 14, y: bodyTop - 42, label: "Booking ID", value: booking.id });
  drawLabelValue({ x: marginX + 14, y: bodyTop - 72, label: "Listing", value: booking.listing.title, valueBold: true });
  drawLabelValue({ x: marginX + 14, y: bodyTop - 102, label: "Renter", value: booking.renter.email });

  drawLabelValue({
    x: pageWidth - marginX - 210,
    y: bodyTop - 42,
    label: "Trip dates",
    value: `${formatDate(booking.startDate)} to ${formatDate(booking.endDate)}`,
    align: "right",
    width: 196,
  });
  drawLabelValue({
    x: pageWidth - marginX - 210,
    y: bodyTop - 72,
    label: "Status",
    value: booking.status,
    valueBold: true,
    align: "right",
    width: 196,
  });
  drawLabelValue({
    x: pageWidth - marginX - 210,
    y: bodyTop - 102,
    label: "Paid at",
    value: booking.paidAt ? booking.paidAt.toLocaleString("en-ZA") : "Pending",
    align: "right",
    width: 196,
  });

  const chargesY = bodyTop - 166;
  page.drawRectangle({
    x: marginX,
    y: chargesY - 160,
    width: pageWidth - marginX * 2,
    height: 160,
    borderColor: palette.border,
    borderWidth: 1,
    color: palette.card,
  });

  page.drawText("Charges", {
    x: marginX + 14,
    y: chargesY - 20,
    size: 12,
    font: fontBold,
    color: palette.textMain,
  });

  const lineLeft = marginX + 14;
  const lineRight = pageWidth - marginX - 14;
  const amountColX = lineRight - 4;

  function drawChargeLine(label: string, amount: string, row: number, bold = false) {
    const y = chargesY - 46 - row * 24;
    const f = bold ? fontBold : font;
    const size = bold ? 12 : 11;
    page.drawText(label, {
      x: lineLeft,
      y,
      size,
      font: f,
      color: bold ? palette.textMain : palette.textMuted,
    });
    const w = f.widthOfTextAtSize(amount, size);
    page.drawText(amount, {
      x: amountColX - w,
      y,
      size,
      font: f,
      color: bold ? palette.textMain : palette.textMuted,
    });
  }

  drawChargeLine(
    `${booking.listing.title} (${booking.days} ${booking.days === 1 ? "day" : "days"})`,
    formatMoney(booking.listing.dailyRateCents * booking.days, booking.currency),
    0,
  );
  drawChargeLine("Daily rate", formatMoney(booking.listing.dailyRateCents, booking.currency), 1);

  page.drawLine({
    start: { x: lineLeft, y: chargesY - 99 },
    end: { x: lineRight, y: chargesY - 99 },
    thickness: 1,
    color: palette.border,
  });

  drawChargeLine("Total paid", formatMoney(booking.totalCents, booking.currency), 3, true);

  const paymentY = chargesY - 190;
  page.drawRectangle({
    x: marginX,
    y: paymentY - 106,
    width: pageWidth - marginX * 2,
    height: 106,
    borderColor: palette.border,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  page.drawText("Payment details", {
    x: marginX + 14,
    y: paymentY - 20,
    size: 12,
    font: fontBold,
    color: palette.textMain,
  });

  drawLabelValue({ x: marginX + 14, y: paymentY - 42, label: "Method", value: paymentMethod });
  drawLabelValue({ x: marginX + 14, y: paymentY - 72, label: "Reference", value: paymentReference, valueBold: true });

  page.drawText("Thank you for choosing RideShare SA.", {
    x: marginX,
    y: 70,
    size: 10,
    font: fontBold,
    color: palette.textMain,
  });
  page.drawText("Keep this receipt for records and support queries.", {
    x: marginX,
    y: 54,
    size: 9,
    font,
    color: palette.textMuted,
  });

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
