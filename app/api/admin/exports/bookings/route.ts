import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";

function csvEscape(v: string) {
  if (/[\n\r,"]/g.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function iso(d: Date | null) {
  return d ? d.toISOString().slice(0, 19).replace("T", " ") : "";
}

export async function GET() {
  await requireRole("ADMIN");

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    take: 10000,
    select: {
      id: true,
      status: true,
      paymentReference: true,
      totalCents: true,
      currency: true,
      days: true,
      startDate: true,
      endDate: true,
      paidAt: true,
      createdAt: true,
      renter: { select: { email: true } },
      listing: { select: { title: true, city: true, host: { select: { email: true } } } },
    },
  });

  const header = [
    "id",
    "status",
    "payment_reference",
    "payment_method",
    "renter_email",
    "host_email",
    "listing_title",
    "listing_city",
    "days",
    "total_amount",
    "currency",
    "start_date",
    "end_date",
    "paid_at",
    "created_at",
  ];

  const lines: string[] = [header.map(csvEscape).join(",")];
  for (const b of bookings) {
    lines.push(
      [
        b.id,
        b.status,
        b.paymentReference ?? "",
        "eft",
        b.renter.email,
        b.listing.host.email,
        b.listing.title,
        b.listing.city,
        String(b.days),
        String((b.totalCents / 100).toFixed(2)),
        b.currency,
        iso(b.startDate),
        iso(b.endDate),
        iso(b.paidAt),
        iso(b.createdAt),
      ]
        .map((v) => csvEscape(String(v ?? "")))
        .join(","),
    );
  }

  const csv = lines.join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bookings-export.csv"`,
      "cache-control": "no-store",
    },
  });
}
