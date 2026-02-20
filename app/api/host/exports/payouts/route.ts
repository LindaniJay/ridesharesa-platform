import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";

function csvEscape(v: string) {
  if (/[\n\r,\"]/g.test(v)) return `"${v.replace(/\"/g, '""')}"`;
  return v;
}

function iso(d: Date | null) {
  return d ? d.toISOString() : "";
}

export async function GET() {
  const { dbUser } = await requireRole("HOST");

  const payouts = await prisma.hostPayout.findMany({
    where: { hostId: dbUser.id },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      amountCents: true,
      currency: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
    },
  });

  const header = [
    "id",
    "amount",
    "currency",
    "status",
    "period_start",
    "period_end",
    "created_at",
  ];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(","));

  for (const p of payouts) {
    lines.push(
      [
        p.id,
        String((p.amountCents ?? 0) / 100),
        p.currency,
        p.status,
        iso(p.periodStart),
        iso(p.periodEnd),
        iso(p.createdAt),
      ]
        .map((v) => csvEscape(String(v ?? "")))
        .join(","),
    );
  }

  const csv = lines.join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="my-payouts.csv"`,
      "cache-control": "no-store",
    },
  });
}
