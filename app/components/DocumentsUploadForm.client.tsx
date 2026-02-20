"use client";

import { useRef, useState } from "react";

import Button from "@/app/components/ui/Button";

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

  const profileRef = useRef<HTMLInputElement | null>(null);
  const idRef = useRef<HTMLInputElement | null>(null);
  const licenseRef = useRef<HTMLInputElement | null>(null);

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
      <input
        ref={profileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)}
      />
      <input
        ref={idRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => setIdDocument(e.target.files?.[0] || null)}
      />
      <input
        ref={licenseRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => setDriversLicense(e.target.files?.[0] || null)}
      />

      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground/80">Required images</div>

        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">Profile photo</div>
              <div className="text-xs text-foreground/60">Face/portrait photo.</div>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => profileRef.current?.click()}
              className="shrink-0"
            >
              Choose image
            </Button>
          </div>
          <div className="mt-2 text-xs text-foreground/60">
            {profilePhoto ? profilePhoto.name : "No image selected"}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">ID document</div>
              <div className="text-xs text-foreground/60">ID / passport image.</div>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => idRef.current?.click()}
              className="shrink-0"
            >
              Choose image
            </Button>
          </div>
          <div className="mt-2 text-xs text-foreground/60">
            {idDocument ? idDocument.name : "No image selected"}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">Driver’s license</div>
              <div className="text-xs text-foreground/60">License front/back (single image).</div>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => licenseRef.current?.click()}
              className="shrink-0"
            >
              Choose image
            </Button>
          </div>
          <div className="mt-2 text-xs text-foreground/60">
            {driversLicense ? driversLicense.name : "No image selected"}
          </div>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Uploading…" : "Upload documents"}
      </Button>

      <div className="text-xs text-foreground/60">Images only • Max 8MB each</div>
    </form>
  );
}
