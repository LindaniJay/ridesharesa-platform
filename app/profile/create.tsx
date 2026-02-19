"use client";

import { useState } from "react";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";

export default function ProfileCreatePage() {
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [driversLicense, setDriversLicense] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (!profilePhoto || !idDocument || !driversLicense) {
      setError("Please upload all required documents.");
      setLoading(false);
      return;
    }

    try {
      const form = new FormData();
      form.set("profilePhoto", profilePhoto);
      form.set("idDocument", idDocument);
      form.set("driversLicense", driversLicense);

      const res = await fetch("/api/account/documents", {
        method: "POST",
        body: form,
      });

      const json = (await res.json().catch(() => null)) as null | { ok?: boolean; error?: string };

      if (res.status === 401) {
        window.location.href = "/sign-in?next=/profile/create";
        return;
      }

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Upload failed. Please try again.");
        return;
      }

      window.location.href = "/renter";
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>
            Please upload your profile photo, ID document, and driver’s license to finish setting up your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <div className="mb-1 text-sm">Profile photo</div>
              <Input type="file" accept="image/*" onChange={e => setProfilePhoto(e.target.files?.[0] || null)} />
            </label>
            <label className="block">
              <div className="mb-1 text-sm">ID document</div>
              <Input type="file" accept="image/*" onChange={e => setIdDocument(e.target.files?.[0] || null)} />
            </label>
            <label className="block">
              <div className="mb-1 text-sm">Driver’s license</div>
              <Input type="file" accept="image/*" onChange={e => setDriversLicense(e.target.files?.[0] || null)} />
            </label>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Uploading…" : "Finish profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
