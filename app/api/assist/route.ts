import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { supabaseServer } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  kind: z.enum(["TIRE", "FUEL"]),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracy: z.number().finite().optional().nullable(),
  contact: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  let userData: Awaited<ReturnType<(typeof supabase.auth)["getUser"]>>["data"];
  try {
    ({ data: userData } = await supabase.auth.getUser());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emailRaw = userData.user?.email;
  if (!emailRaw) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = emailRaw.toLowerCase().trim();

  // Only allow HOST/RENTER from metadata. Never grant ADMIN via metadata.
  const metadataRoleRaw = userData.user?.user_metadata?.role;
  const metadataRole = metadataRoleRaw === "HOST" || metadataRoleRaw === "RENTER" ? metadataRoleRaw : null;

  const dbUser = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      role: metadataRole === "HOST" ? "HOST" : "RENTER",
      status: "ACTIVE",
      idVerificationStatus: "UNVERIFIED",
      driversLicenseStatus: "UNVERIFIED",
    },
    update: {},
    select: { id: true, status: true },
  });

  if (dbUser.status === "SUSPENDED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { kind, latitude, longitude, accuracy, contact, notes } = parsed.data;

  const title = kind === "TIRE" ? "Roadside assist: Flat tyre" : "Roadside assist: Out of fuel";
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
