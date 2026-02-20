import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function assertCanAccessBooking(params: { bookingId: string; viewerId: string; viewerRole: string }) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    select: {
      id: true,
      renterId: true,
      listing: { select: { hostId: true } },
    },
  });

  if (!booking) return { ok: false as const, status: 404 as const, booking: null };

  const isAdmin = params.viewerRole === "ADMIN";
  const isRenter = params.viewerRole === "RENTER" && booking.renterId === params.viewerId;
  const isHost = params.viewerRole === "HOST" && booking.listing.hostId === params.viewerId;

  if (!isAdmin && !isRenter && !isHost) {
    return { ok: false as const, status: 403 as const, booking: null };
  }

  return { ok: true as const, status: 200 as const, booking };
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { dbUser } = await requireUser();
  const { id: bookingId } = await context.params;

  const access = await assertCanAccessBooking({
    bookingId,
    viewerId: dbUser.id,
    viewerRole: dbUser.role,
  });

  if (!access.ok) {
    return NextResponse.json({ error: access.status === 404 ? "Booking not found" : "Forbidden" }, { status: access.status });
  }

  const messages = await prisma.bookingMessage.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      sender: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
    take: 200,
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { dbUser } = await requireUser();
  const { id: bookingId } = await context.params;

  const access = await assertCanAccessBooking({
    bookingId,
    viewerId: dbUser.id,
    viewerRole: dbUser.role,
  });

  if (!access.ok) {
    return NextResponse.json({ error: access.status === 404 ? "Booking not found" : "Forbidden" }, { status: access.status });
  }

  const json = (await req.json().catch(() => null)) as null | { body?: unknown };
  if (!json) return badRequest("Expected JSON body");

  const bodyRaw = typeof json.body === "string" ? json.body : String(json.body ?? "");
  const body = bodyRaw.trim();
  if (!body) return badRequest("Message cannot be empty");
  if (body.length > 2000) return badRequest("Message too long (max 2000 characters)");

  const message = await prisma.bookingMessage.create({
    data: {
      bookingId,
      senderId: dbUser.id,
      body,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      sender: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}
