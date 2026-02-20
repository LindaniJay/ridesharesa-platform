"use client";

import { useState } from "react";

import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";

export default function DocumentsUploadForm({
  successHref,
  nextHref,
}: {
  successHref: string;
  nextHref?: string;
}) {
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [driversLicense, setDriversLicense] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!profilePhoto || !idDocument || !driversLicense) {
      setError("Please upload all required images.");
      return;
    }

    setLoading(true);

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
        const next = nextHref ? encodeURIComponent(nextHref) : "";
        window.location.href = next ? `/sign-in?next=${next}` : "/sign-in";
        return;
      }

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Upload failed. Please try again.");
        return;
      }

      window.location.href = successHref;
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <div className="mb-1 text-sm">Profile photo</div>
        <Input type="file" accept="image/*" onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)} />
      </label>
      <label className="block">
        <div className="mb-1 text-sm">ID document</div>
        <Input type="file" accept="image/*" onChange={(e) => setIdDocument(e.target.files?.[0] || null)} />
      </label>
      <label className="block">
        <div className="mb-1 text-sm">Driver’s license</div>
        <Input type="file" accept="image/*" onChange={(e) => setDriversLicense(e.target.files?.[0] || null)} />
      </label>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Uploading…" : "Upload documents"}
      </Button>

      <div className="text-xs text-foreground/60">Images only • Max 8MB each</div>
    </form>
  );
}
