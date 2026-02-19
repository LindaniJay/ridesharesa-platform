import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { sendPush } from "@/app/lib/push/server";
import { supabaseServer } from "@/app/lib/supabase/server";

type SendBody = {
  title?: unknown;
  body?: unknown;
  url?: unknown;
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
  const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });

  if (!dbUser || dbUser.status === "SUSPENDED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sendBody = (await req.json()) as SendBody;
  const title = typeof sendBody.title === "string" ? sendBody.title : "RideShare";
  const body = typeof sendBody.body === "string" ? sendBody.body : "Test notification";
  const url = typeof sendBody.url === "string" ? sendBody.url : "/";

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: dbUser.id },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const payload = { title, body, url };

  let sent = 0;
  let removed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const sub of subscriptions) {
    try {
      await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      sent += 1;
    } catch (error: unknown) {
      const maybeError = error as { statusCode?: unknown; message?: unknown };
      const statusCode = typeof maybeError?.statusCode === "number" ? maybeError.statusCode : null;

      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
        removed += 1;
        continue;
      }

      errors.push({ id: sub.id, error: String(maybeError?.message ?? error) });
    }
  }

  return NextResponse.json({ ok: true, sent, removed, errors });
}
