import { NextResponse } from "next/server";

const SUPABASE_DEV_DISABLE_COOKIE = "__supabase_dev_disable";

function clearCookie() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SUPABASE_DEV_DISABLE_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return clearCookie();
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return clearCookie();
}
