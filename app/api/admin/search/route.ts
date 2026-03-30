import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";

export async function GET(req: Request) {
  await requireRole("ADMIN");

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return NextResponse.json({ results: [] });

  const like = { contains: q, mode: "insensitive" as const };

  const [users, listings, bookings, tickets] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { not: "ADMIN" },
        OR: [{ email: like }, { name: like }, { surname: like }],
      },
      take: 5,
      select: { id: true, email: true, role: true, createdAt: true },
    }),
    prisma.listing.findMany({
      where: {
        OR: [{ title: like }, { city: like }],
      },
      take: 5,
      select: { id: true, title: true, city: true, status: true },
    }),
    prisma.booking.findMany({
      where: {
        OR: [
          { paymentReference: like },
          { renter: { email: like } },
          { listing: { title: like } },
        ],
      },
      take: 5,
      select: {
        id: true,
        status: true,
        paymentReference: true,
        renter: { select: { email: true } },
        listing: { select: { title: true } },
      },
    }),
    prisma.supportTicket.findMany({
      where: {
        OR: [{ subject: like }, { user: { email: like } }],
      },
      take: 5,
      select: { id: true, subject: true, status: true, user: { select: { email: true } } },
    }),
  ]);

  type Result = {
    kind: "user" | "listing" | "booking" | "ticket";
    id: string;
    label: string;
    sub: string;
    href: string;
  };

  const results: Result[] = [
    ...users.map((u) => ({
      kind: "user" as const,
      id: u.id,
      label: u.email,
      sub: `${u.role} • joined ${u.createdAt.toISOString().slice(0, 10)}`,
      href: `/admin?section=users&userId=${u.id}`,
    })),
    ...listings.map((l) => ({
      kind: "listing" as const,
      id: l.id,
      label: l.title,
      sub: `${l.city} • ${l.status}`,
      href: `/admin?section=vehicles&listingId=${l.id}`,
    })),
    ...bookings.map((b) => ({
      kind: "booking" as const,
      id: b.id,
      label: b.listing.title,
      sub: `${b.renter.email} • ${b.status}${b.paymentReference ? ` • Ref: ${b.paymentReference}` : ""}`,
      href: `/admin?section=bookings`,
    })),
    ...tickets.map((t) => ({
      kind: "ticket" as const,
      id: t.id,
      label: t.subject,
      sub: `${t.user.email} • ${t.status}`,
      href: `/admin?section=support`,
    })),
  ];

  return NextResponse.json({ results });
}
