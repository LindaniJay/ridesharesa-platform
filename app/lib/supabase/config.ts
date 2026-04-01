function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function validateJwt(key: string, label: string) {
  const trimmed = key.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    throw new Error(
      `${label} is not a valid JWT (${parts.length} segment(s), length ${trimmed.length}). Check for truncation or extra whitespace.`,
    );
  }
  return trimmed;
}

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)");

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { url: url.trim(), anonKey: validateJwt(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY") };
}
