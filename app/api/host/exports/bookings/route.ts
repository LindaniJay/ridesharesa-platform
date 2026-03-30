import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";

function csvEscape(v: string) {
  if (/[\n\r,"]/g.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function iso(d: Date | null) {
  return d ? d.toISOString() : "";
}

export async function GET() {
  const { dbUser } = await requireRole("HOST");

  const bookings = await prisma.booking.findMany({
    where: { listing: { hostId: dbUser.id } },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      status: true,
      totalCents: true,
      currency: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      renter: { select: { email: true } },
      listing: { select: { title: true, city: true } },
    },
  });

  const header = [
    "id",
    "status",
    "total",
    "currency",
    "start_date",
    "end_date",
    "created_at",
    "renter_email",
    "listing_title",
    "listing_city",
  ];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(","));

  for (const b of bookings) {
    lines.push(
      [
        b.id,
        b.status,
        String((b.totalCents ?? 0) / 100),
        b.currency,
        iso(b.startDate),
        iso(b.endDate),
        iso(b.createdAt),
        b.renter.email,
        b.listing.title,
        b.listing.city,
      ]
        .map((v) => csvEscape(String(v ?? "")))
        .join(","),
    );
  }

  const csv = `${lines.join("\n")}\n`;
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="my-bookings.csv"',
      "cache-control": "no-store",
    },
  });
}
