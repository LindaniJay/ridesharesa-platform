import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

const BodySchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    surname: z.string().trim().max(120).optional(),
  })
  .strict();

function normalizeText(v: string | undefined) {
  const s = (v ?? "").trim();
  if (!s) return null;
  return s.slice(0, 120);
}

export async function PATCH(req: Request) {
  const { supabaseUser, dbUser } = await requireUser();

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = normalizeText(parsed.data.name);
  const surname = normalizeText(parsed.data.surname);

  await supabaseAdmin().auth.admin.updateUserById(supabaseUser.id, {
    user_metadata: {
      ...supabaseUser.user_metadata,
      name,
      surname,
      profileUpdatedAt: new Date().toISOString(),
    },
  });

  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      name,
      surname,
    },
  });

  return NextResponse.json({ ok: true });
}
