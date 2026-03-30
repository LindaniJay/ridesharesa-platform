"use client";

import { useRef, useState } from "react";
import type React from "react";

import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";

export default function DocumentsUploadForm({
  successHref,
  nextHref,
  autoRedirectByRole = false,
}: {
  successHref: string;
  nextHref?: string;
  autoRedirectByRole?: boolean;
}): React.ReactElement {
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [driversLicense, setDriversLicense] = useState<File | null>(null);
  const [proofOfResidence, setProofOfResidence] = useState<File | null>(null);
  const [proofOfResidenceIssuedAt, setProofOfResidenceIssuedAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const profileRef = useRef<HTMLInputElement | null>(null);
  const idRef = useRef<HTMLInputElement | null>(null);
  const licenseRef = useRef<HTMLInputElement | null>(null);
  const proofRef = useRef<HTMLInputElement | null>(null);

  function isProofIssueDateValid(value: string) {
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;

    const now = new Date();
    if (parsed > now) return false;
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return parsed >= threeMonthsAgo;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!profilePhoto || !idDocument || !driversLicense || !proofOfResidence) {
      setError("Please upload all required documents.");
      return;
    }

    if (!isProofIssueDateValid(proofOfResidenceIssuedAt)) {
      setError("Proof of residence must be issued within the last 3 months.");
      return;
    }

    setLoading(true);

    try {
      const form = new FormData();
      form.set("profilePhoto", profilePhoto);
      form.set("idDocument", idDocument);
      form.set("driversLicense", driversLicense);
      form.set("proofOfResidence", proofOfResidence);
      form.set("proofOfResidenceIssuedAt", proofOfResidenceIssuedAt);
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
        // Enhanced error handling
        if (json?.error) {
          if (json.error.includes("File too large")) {
            setError("File too large. Max 8MB per document.");
          } else if (json.error.includes("Only images or PDF uploads are supported")) {
            setError("Unsupported file type. Only images or PDF allowed.");
          } else if (json.error.toLowerCase().includes("bucket") || json.error.toLowerCase().includes("not found")) {
            setError("Storage bucket not found. Please contact support.");
          } else {
            setError(json.error);
          }
        } else {
          setError("Upload failed. Please try again.");
        }
        return;
      }

      if (autoRedirectByRole) {
        const meRes = await fetch("/api/me", { cache: "no-store" });
        const meData = (await meRes.json().catch(() => null)) as null | {
          user: { role: "ADMIN" | "HOST" | "RENTER" } | null;
        };
        const role = meData?.user?.role;
        if (role === "ADMIN") {
          window.location.href = "/admin";
          return;
        }
        if (role === "HOST") {
          window.location.href = "/host";
          return;
        }
      }

      window.location.href = successHref;
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("File too large")) {
          setError("File too large. Max 8MB per document.");
        } else if (err.message.includes("Only images or PDF uploads are supported")) {
          setError("Unsupported file type. Only images or PDF allowed.");
        } else if (err.message.toLowerCase().includes("bucket") || err.message.toLowerCase().includes("not found")) {
          setError("Storage bucket not found. Please contact support.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Upload failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

    return (
      <form onSubmit={onSubmit} className="space-y-5">
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
      <input
        ref={proofRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => setProofOfResidence(e.target.files?.[0] || null)}
      />

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Document checklist</div>
            <div className="text-xs text-foreground/60">Upload all items to complete profile verification.</div>
          </div>
          <div className="text-xs text-foreground/60">Accepted: images (JPG/PNG/WEBP) + PDF for proof of residence</div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className={`rounded-md border px-2 py-1 text-xs ${profilePhoto ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300" : "border-border bg-background text-foreground/60"}`}>
            Profile photo {profilePhoto ? "uploaded" : "missing"}
          </div>
          <div className={`rounded-md border px-2 py-1 text-xs ${idDocument ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300" : "border-border bg-background text-foreground/60"}`}>
            ID document {idDocument ? "uploaded" : "missing"}
          </div>
          <div className={`rounded-md border px-2 py-1 text-xs ${driversLicense ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300" : "border-border bg-background text-foreground/60"}`}>
            Driver&apos;s license {driversLicense ? "uploaded" : "missing"}
          </div>
          <div className={`rounded-md border px-2 py-1 text-xs ${proofOfResidence ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300" : "border-border bg-background text-foreground/60"}`}>
            Proof of residence {proofOfResidence ? "uploaded" : "missing"}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium text-foreground/80">Required documents</div>

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
              <div className="font-medium">Driver&apos;s license</div>
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

        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">Proof of residence</div>
              <div className="text-xs text-foreground/60">Utility bill or bank statement not older than 3 months.</div>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => proofRef.current?.click()}
              className="shrink-0"
            >
              Choose file
            </Button>
          </div>
          <div className="mt-2 text-xs text-foreground/60">
            {proofOfResidence ? proofOfResidence.name : "No file selected"}
          </div>
          <div className="mt-3 max-w-xs">
            <div className="mb-1 text-xs text-foreground/60">Issue date on proof (must be within 3 months)</div>
            <Input
              type="date"
              value={proofOfResidenceIssuedAt}
              onChange={(e) => setProofOfResidenceIssuedAt(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Uploading..." : "Submit for verification"}
      </Button>

      <div className="text-xs text-foreground/60">Max 8MB each. Verification usually takes up to 24 hours.</div>
    </form>
  );
}
