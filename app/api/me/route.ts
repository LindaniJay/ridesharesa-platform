import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { supabaseServer } from "@/app/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  let data: Awaited<ReturnType<(typeof supabase.auth)["getUser"]>>["data"];
  try {
    ({ data } = await supabase.auth.getUser());
  } catch {
    return NextResponse.json({ user: null });
  }

  if (!data.user?.email) {
    return NextResponse.json({ user: null });
  }

  const email = data.user.email.toLowerCase().trim();

  // Only allow HOST/RENTER from metadata. Never grant ADMIN via metadata.
  const metadataRoleRaw = data.user.user_metadata?.role;
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
    select: { email: true, role: true, status: true },
  });

  if (dbUser.status === "SUSPENDED") {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: { email: dbUser.email, role: dbUser.role } });
}
