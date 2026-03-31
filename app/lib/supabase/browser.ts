import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/app/lib/supabase/config";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserClient | null = null;

function getProjectRef(url: string) {
  try {
    const host = new URL(url).hostname;
    const [projectRef] = host.split(".");
    return projectRef?.trim() || "";
  } catch {
    return "";
  }
}

export function supabaseBrowser() {
  const { url, anonKey } = getSupabasePublicConfig();
  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}

export async function clearInvalidRefreshTokenSession() {
  if (typeof window === "undefined") return;

  const client = supabaseBrowser();
  const { error } = await client.auth.getSession();
  const message = (error as { message?: unknown } | null)?.message;

  if (typeof message !== "string") return;
  if (!/invalid\s*refresh\s*token|refresh\s*token\s*not\s*found/i.test(message)) return;

  await client.auth.signOut();

  const { url } = getSupabasePublicConfig();
  const projectRef = getProjectRef(url);
  if (!projectRef) return;

  try {
    window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
    window.localStorage.removeItem(`sb-${projectRef}-auth-token-code-verifier`);
  } catch {
    // Ignore localStorage cleanup failures.
  }
}
