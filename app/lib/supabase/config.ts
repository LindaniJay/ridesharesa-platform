function requireEnv(name: string) {
  // Strip ALL whitespace — Vercel can inject line-breaks in long env values.
  const value = process.env[name]?.replace(/\s+/g, "");
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)");

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { url: url.replace(/\s+/g, ""), anonKey: anonKey.replace(/\s+/g, "") };
}
