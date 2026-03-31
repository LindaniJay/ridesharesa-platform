"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import { supabaseBrowser } from "@/app/lib/supabase/browser";

type MeResponse =
  | { user: null }
  | {
      user: {
        email: string;
        role: "ADMIN" | "HOST" | "RENTER";
      };
    };

function sanitizeCallbackUrl(value: string | null) {
  if (!value) return "/";
  // Only allow local paths.
  return value.startsWith("/") ? value : "/";
}

function defaultDashboardForRole(role: "ADMIN" | "HOST" | "RENTER") {
  if (role === "ADMIN") return "/admin";
  if (role === "HOST") return "/host";
  return "/renter";
}

function isProtectedDashboardPath(path: string) {
  return path === "/admin" || path.startsWith("/admin/") || path === "/host" || path.startsWith("/host/") || path === "/renter" || path.startsWith("/renter/");
}

function isAllowedDashboardPathForRole(path: string, role: "ADMIN" | "HOST" | "RENTER") {
  if (path === "/admin" || path.startsWith("/admin/")) return role === "ADMIN";
  if (path === "/host" || path.startsWith("/host/")) return role === "HOST";
  if (path === "/renter" || path.startsWith("/renter/")) return role === "RENTER";
  return true;
}

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

export default function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function clearSupabaseDevDisable() {
    try {
      await fetch("/api/dev/clear-supabase-disable", { method: "POST" });
    } catch {
      // Ignore.
    }
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Add timeout for sign-in request
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Sign-in request timeout - please try again")), 30000)
      );

      const signInPromise = supabaseBrowser().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      const { error: signInError } = await Promise.race([signInPromise, timeoutPromise]);

    if (signInError) {
      const raw = String(signInError.message || "Sign-in failed");
      if (/email\s+not\s+confirmed/i.test(raw)) {
        setError("This project is configured to sign in without email confirmation. Disable 'Confirm email' in Supabase Auth settings, then try again.");
      } else if (/invalid\s+login\s+credentials/i.test(raw)) {
        setError("Invalid email or password");
      } else {
        setError(raw);
      }
      setLoading(false);
      return;
    }

      // Ensure DB user exists / is hydrated with timeout (30s for first compile)
      let bootstrapOk = false;
      try {
        const bootstrapRes = await Promise.race([
          fetch("/api/account/bootstrap", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          }),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error("Bootstrap timeout - server may be slow")), 30000)
          ),
        ]);
        const json = (await bootstrapRes.json().catch(() => null)) as null | { ok?: boolean; error?: string; message?: string };
        bootstrapOk = Boolean(json?.ok);
        if (!bootstrapOk && json) {
          // Error is already captured in bootstrapOk state
        }
      } catch {
        bootstrapOk = false;
      }

      if (!bootstrapOk) {
        setLoading(false);
        setError(
          "Signed in, but the server couldn't finish setup. Please refresh the page and try again.",
        );
        return;
      }

      // Fetch user profile with timeout
      let me: MeResponse = { user: null };
      try {
        me = await Promise.race([
          fetch("/api/me", { cache: "no-store" }).then(async (r) => (await r.json()) as MeResponse),
          new Promise<MeResponse>((_, reject) =>
            setTimeout(() => reject(new Error("Profile fetch timeout")), 15000)
          ),
        ]);
      } catch {
        me = { user: null };
      }

      if (!me.user) {
        setLoading(false);
        setError(
          "Signed in, but your profile could not be loaded. Please refresh the page and try again.",
        );
        return;
      }

      const fallback = defaultDashboardForRole(me.user.role);
      const destination =
        isProtectedDashboardPath(callbackUrl) && !isAllowedDashboardPathForRole(callbackUrl, me.user.role)
          ? fallback
          : callbackUrl === "/"
            ? fallback
            : callbackUrl;

      setLoading(false);
      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to manage bookings and listings.</CardDescription>
        </CardHeader>
        <CardContent>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <div className="mb-1 text-sm">Email</div>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </label>

        <label className="block">
          <div className="mb-1 text-sm">Password</div>
          <div className="relative">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="pr-10"
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
        </label>

        {error && <div className="text-sm text-red-600">{error}</div>}

        {error?.includes("__supabase_dev_disable") ? (
          <Button type="button" variant="secondary" className="w-full" onClick={clearSupabaseDevDisable}>
            Clear dev auth disable and retry
          </Button>
        ) : null}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        <div className="text-sm text-foreground/60">
          No account? <Link className="underline" href="/sign-up">Sign up</Link>
        </div>
      </form>
        </CardContent>
      </Card>
    </main>
  );
}
