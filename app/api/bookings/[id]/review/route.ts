import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";

type ReviewPayload = {
  rating: number;
  comment: string | null;
};

function parseBody(input: unknown): ReviewPayload | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as { rating?: unknown; comment?: unknown };

  const ratingNum = Number(obj.rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) return null;

  const commentRaw = typeof obj.comment === "string" ? obj.comment.trim() : "";
  if (commentRaw.length > 1000) return null;

  return {
    rating: ratingNum,
    comment: commentRaw ? commentRaw : null,
  };
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { dbUser } = await requireUser();
  if (dbUser.role !== "RENTER") {
    return NextResponse.json({ error: "Only renters can submit reviews" }, { status: 403 });
  }

  const { id: bookingId } = await context.params;

  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = parseBody(json);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid payload. rating must be 1-5 and comment max 1000 chars" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      renterId: true,
      endDate: true,
      status: true,
      listing: {
        select: {
          hostId: true,
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.renterId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (booking.status !== "CONFIRMED") {
    return NextResponse.json({ error: "Reviews can only be added for confirmed bookings" }, { status: 400 });
  }

  if (booking.endDate > new Date()) {
    return NextResponse.json({ error: "Reviews can only be submitted after the trip ends" }, { status: 400 });
  }

  const existing = await prisma.review.findFirst({
    where: {
      bookingId: booking.id,
      authorId: dbUser.id,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.review.update({
      where: { id: existing.id },
      data: {
        rating: parsed.rating,
        comment: parsed.comment,
      },
    });
    return NextResponse.json({ ok: true, updated: true });
  }

  await prisma.review.create({
    data: {
      bookingId: booking.id,
      authorId: dbUser.id,
      targetUserId: booking.listing.hostId,
      rating: parsed.rating,
      comment: parsed.comment,
    },
  });

  return NextResponse.json({ ok: true, created: true }, { status: 201 });
}
