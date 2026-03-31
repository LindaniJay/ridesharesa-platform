"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { supabaseBrowser } from "@/app/lib/supabase/browser";

function EyeOpenIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
      <path d="M9 5.2A11.2 11.2 0 0 1 12 5c6.5 0 10 7 10 7a16.6 16.6 0 0 1-3.2 3.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.2 8.1A16.8 16.8 0 0 0 2 12s3.5 7 10 7c1 0 1.9-.1 2.8-.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"RENTER" | "HOST">("RENTER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const client = supabaseBrowser();
      const normalizedEmail = email.trim().toLowerCase();

      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout - please try again")), 30000)
      );

      const { data, error: signUpError } = await Promise.race([
        client.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { name: name || undefined, role },
          },
        }),
        timeoutPromise,
      ]);

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setError("This app expects direct sign-up without email confirmation. Disable 'Confirm email' in Supabase Auth settings and try again.");
        setLoading(false);
        return;
      }

      let bootstrapRes = await fetch("/api/account/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name || undefined, role }),
      });

      if (bootstrapRes.status === 401 || bootstrapRes.status === 403) {
        // In some environments cookie/session propagation can lag right after sign-up.
        const { error: signInAfterSignUpError } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (!signInAfterSignUpError) {
          bootstrapRes = await fetch("/api/account/bootstrap", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: name || undefined, role }),
          });
        }
      }

      const bootstrapJson = (await bootstrapRes.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!bootstrapRes.ok || bootstrapJson.ok === false) {
        setError(`Setup failed: ${bootstrapJson.message || bootstrapJson.error || "Unknown error"}`);
        setLoading(false);
        return;
      }

      setLoading(false);
      // Redirect to dashboard - profile can be completed from there
      router.push(role === "HOST" ? "/host" : "/renter");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Choose renter or host—admin approval handles listings.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            {/* ...existing code... */}
            {/* Document upload fields removed. */}
            <label className="block">
              <div className="mb-1 text-sm">Name (optional)</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                autoComplete="name"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm">Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm">Password</div>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-accent/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 inline-flex items-center text-foreground/60 hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
              </div>
              <div className="mt-1 text-xs text-foreground/50">Minimum 8 characters</div>
            </label>
            <label className="block">
              <div className="mb-1 text-sm">Account type</div>
              <select
                value={role}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "HOST" || value === "RENTER") {
                    setRole(value);
                  }
                }}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="RENTER">Renter (book cars)</option>
                <option value="HOST">Host (list cars)</option>
              </select>
            </label>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating…" : "Create account"}
            </Button>
            <div className="text-sm text-foreground/60">
              Already have an account? <Link className="underline" href="/sign-in">Sign in</Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="text-xs text-foreground/50">
        Accounts are managed via Supabase Auth. Use a strong password in production.
      </div>
    </main>
  );
}
