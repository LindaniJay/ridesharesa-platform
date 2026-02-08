import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/app/lib/supabase/config";

export function supabaseBrowser() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createBrowserClient(url, anonKey);
}
