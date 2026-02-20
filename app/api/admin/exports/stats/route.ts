import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";

function csvEscape(v: string) {
  if (/[\n\r,\"]/g.test(v)) return `"${v.replace(/\"/g, '""')}"`;
  return v;
}

export async function GET() {
  await requireRole("ADMIN");

  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    usersAll,
    listingsAll,
    bookingsAll,
    bookings30d,
    signups30d,
    confirmedRevenue30dZar,
    payoutsPaid30dZar,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.booking.count(),
    prisma.booking.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.user.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.booking.aggregate({
      where: { status: "CONFIRMED", createdAt: { gte: windowStart }, currency: "ZAR" },
      _sum: { totalCents: true },
    }),
    prisma.hostPayout.aggregate({
      where: { status: "PAID", createdAt: { gte: windowStart }, currency: "ZAR" },
      _sum: { amountCents: true },
    }),
  ]);

  const lines: string[] = [];
  lines.push(["metric", "value"].map(csvEscape).join(","));

  const rows: Array<[string, string]> = [
    ["generated_at", now.toISOString()],
    ["window_start", windowStart.toISOString()],
    ["window_days", "30"],
    ["users_all", String(usersAll)],
    ["listings_all", String(listingsAll)],
    ["bookings_all", String(bookingsAll)],
    ["bookings_created_30d", String(bookings30d)],
    ["signups_30d", String(signups30d)],
    ["confirmed_revenue_30d_zar", String((confirmedRevenue30dZar._sum.totalCents ?? 0) / 100)],
    ["payouts_paid_30d_zar", String((payoutsPaid30dZar._sum.amountCents ?? 0) / 100)],
  ];

  for (const [k, v] of rows) lines.push([k, v].map(csvEscape).join(","));

  const csv = lines.join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=\"stats-30d.csv\"`,
      "cache-control": "no-store",
    },
  });
}
