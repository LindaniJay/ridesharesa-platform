function requireEnv(name: string) {
  const value = process.env[name];
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

  return { url, anonKey };
}
