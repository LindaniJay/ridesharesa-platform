"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { supabaseBrowser } from "@/app/lib/supabase/browser";

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"RENTER" | "HOST">("RENTER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signUpError } = await supabaseBrowser().auth.signUp({
      email,
      password,
      options: {
        data: { name: name || undefined, role },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is enabled, the session may be null.
    if (!data.session) {
      setLoading(false);
      router.push("/sign-in?checkEmail=1");
      return;
    }

    await fetch("/api/account/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name || undefined, role }),
    }).catch(() => null);

    setLoading(false);
    // After signup, take the user to their dashboard
    // where they can complete profile & documents.
    router.push(role === "HOST" ? "/host" : "/renter");
    router.refresh();
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
                className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
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
                className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm">Password</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
              />
              <div className="mt-1 text-xs text-black/50 dark:text-white/50">Minimum 8 characters</div>
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
                className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
              >
                <option value="RENTER">Renter (book cars)</option>
                <option value="HOST">Host (list cars)</option>
              </select>
            </label>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating…" : "Create account"}
            </Button>
            <div className="text-sm text-black/60 dark:text-white/60">
              Already have an account? <Link className="underline" href="/sign-in">Sign in</Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="text-xs text-black/50 dark:text-white/50">
        Accounts are managed via Supabase Auth. Use a strong password in production.
      </div>
    </main>
  );
}
