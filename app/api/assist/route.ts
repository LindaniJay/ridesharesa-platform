import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";

export const runtime = "nodejs";

const BodySchema = z.object({
  kind: z.enum(["TIRE", "FUEL", "BATTERY", "BREAKDOWN", "ACCIDENT", "LOCKOUT", "MEDICAL", "SECURITY"]),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracy: z.number().finite().optional().nullable(),
  contact: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function POST(req: Request) {
  // Only allow renters to use Tire Assist
  const { dbUser } = await requireRole("RENTER");

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { kind, latitude, longitude, accuracy, contact, notes } = parsed.data;

  const kindLabel: Record<z.infer<typeof BodySchema>["kind"], string> = {
    TIRE: "Flat tyre",
    FUEL: "Out of fuel",
    BATTERY: "Flat battery",
    BREAKDOWN: "Mechanical breakdown",
    ACCIDENT: "Accident / collision",
    LOCKOUT: "Vehicle lockout",
    MEDICAL: "Medical emergency support",
    SECURITY: "Security / police support",
  };

  const title = `Roadside assist: ${kindLabel[kind]}`;
  const detailsLines = [
    `Type: ${kind}`,
    `Location: ${latitude}, ${longitude}${typeof accuracy === "number" ? ` (accuracy ~${Math.round(accuracy)}m)` : ""}`,
    contact ? `Contact: ${contact}` : null,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean);

  const incident = await prisma.incidentReport.create({
    data: {
      userId: dbUser.id,
      type: "SUPPORT",
      status: "OPEN",
      title,
      details: detailsLines.join("\n"),
    },
    select: { id: true },
  });

  return NextResponse.json({ incidentId: incident.id });
}
