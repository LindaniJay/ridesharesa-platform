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

export default function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));
  const checkEmail = searchParams.get("checkEmail") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        setError("Email not confirmed. Check your inbox for the confirmation link, or disable email confirmations in Supabase Auth settings for development.");
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
      let bootstrapError = "";
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
          bootstrapError = json.error || json.message || "Unknown error";
        }
      } catch (e) {
        bootstrapOk = false;
        bootstrapError = e instanceof Error ? e.message : "Unknown error";
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
      } catch (e) {
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
          {checkEmail ? (
            <div className="mb-3 rounded-md border border-foreground/10 bg-foreground/5 p-3 text-sm text-foreground/70">
              Check your email to confirm your account, then come back and sign in.
            </div>
          ) : null}
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
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
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
