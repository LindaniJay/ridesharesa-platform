"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import { supabaseBrowser } from "@/app/lib/supabase/browser";

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"RENTER" | "HOST">("RENTER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [driversLicense, setDriversLicense] = useState<File | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!profilePhoto || !idDocument || !driversLicense) {
      setError("Please attach a profile photo, ID document, and driver's license.");
      setLoading(false);
      return;
    }

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
      setError(
        "Email confirmation is enabled, so we can’t upload required documents until your account is confirmed. Disable email confirmation in Supabase for this environment, or make document upload optional.",
      );
      setLoading(false);
      return;
    }

    await fetch("/api/account/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name || undefined, role }),
    }).catch(() => null);

    const form = new FormData();
    form.set("profilePhoto", profilePhoto);
    form.set("idDocument", idDocument);
    form.set("driversLicense", driversLicense);

    const uploadRes = await fetch("/api/account/documents", {
      method: "POST",
      body: form,
    }).catch(() => null);

    if (!uploadRes || !uploadRes.ok) {
      const details = await uploadRes
        ?.json()
        .then((j) => (typeof j?.error === "string" ? j.error : null))
        .catch(() => null);

      setError(details || "Document upload failed. Please retry.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push(role === "HOST" ? "/host" : "/listings");
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
            <label className="block">
              <div className="mb-1 text-sm">Name (optional)</div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                autoComplete="name"
              />
            </label>

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
                autoComplete="new-password"
                required
                minLength={8}
              />
              <div className="mt-1 text-xs text-foreground/60">Minimum 8 characters</div>
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
                className="w-full"
              >
                <option value="RENTER">Renter (book cars)</option>
                <option value="HOST">Host (list cars)</option>
              </select>
            </label>

            <div className="rounded-2xl border border-border bg-background p-3">
              <div className="text-sm font-medium">Required documents</div>
              <div className="mt-1 text-xs text-foreground/60">
                Upload clear images. These are used for verification.
              </div>

              <div className="mt-3 space-y-3">
                <label className="block">
                  <div className="mb-1 text-sm">Profile photo</div>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setProfilePhoto(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-sm">ID document (photo)</div>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setIdDocument(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-sm">Driver’s license (photo)</div>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setDriversLicense(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
                  />
                </label>
              </div>
            </div>

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

      <div className="text-xs text-foreground/60">
        Accounts are managed via Supabase Auth. Use a strong password in production.
      </div>
    </main>
  );
}
