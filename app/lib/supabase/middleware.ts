import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/app/lib/supabase/config";

export async function updateSupabaseSession(request: NextRequest) {
  // In development, middleware-based session refresh is optional and can be
  // problematic on corporate networks (SSL inspection) because middleware may
  // not share the same TLS trust configuration as the Node runtime.
  // We skip Supabase calls here and rely on the browser client + server routes.
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  const { url, anonKey } = getSupabasePublicConfig();

  const safeFetch: typeof fetch = async (input, init) => {
    try {
      return await fetch(input, init);
    } catch {
      return new Response(null, { status: 503, statusText: "fetch failed" });
    }
  };

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    global: {
      fetch: safeFetch,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Triggers cookie refresh when needed.
  await supabase.auth.getUser().catch(() => null);

  return response;
}
