import { NextResponse } from "next/server";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieNames = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split("=")[0])
    .filter(Boolean);

  const uniqueNames = Array.from(new Set(cookieNames));
  const supabaseCookieNames = uniqueNames.filter((n) => n.startsWith("sb-") || n.includes("supabase"));

  return NextResponse.json({
    cookieHeaderLength: cookieHeader.length,
    cookieCount: uniqueNames.length,
    cookieNames: uniqueNames,
    supabaseCookieNames,
  });
}
