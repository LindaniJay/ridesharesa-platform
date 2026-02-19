import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { supabaseServer } from "@/app/lib/supabase/server";

type SubscriptionBody = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  let userData: Awaited<ReturnType<(typeof supabase.auth)["getUser"]>>["data"];
  try {
    ({ data: userData } = await supabase.auth.getUser());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!userData.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = userData.user.email.toLowerCase().trim();

  const appRoleRaw = userData.user.app_metadata?.role;
  const appRole = appRoleRaw === "ADMIN" ? "ADMIN" : null;

  const metadataRoleRaw = userData.user.user_metadata?.role;
  const metadataRole = metadataRoleRaw === "HOST" || metadataRoleRaw === "RENTER" ? metadataRoleRaw : null;

  const dbUser = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      role: appRole ?? (metadataRole === "HOST" ? "HOST" : "RENTER"),
      status: "ACTIVE",
      idVerificationStatus: "UNVERIFIED",
      driversLicenseStatus: "UNVERIFIED",
    },
    update: appRole === "ADMIN" ? { role: "ADMIN" } : {},
    select: { id: true, status: true },
  });

  if (dbUser.status === "SUSPENDED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as SubscriptionBody;
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : null;
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") ?? undefined;

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth, userAgent, userId: dbUser.id },
    update: { p256dh, auth, userAgent, userId: dbUser.id },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, subscriptionId: subscription.id });
}
