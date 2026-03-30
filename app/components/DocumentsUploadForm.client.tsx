"use client";

import { useState } from "react";
import type React from "react";

import Button from "@/app/components/ui/Button";
import FileDropInput from "@/app/components/FileDropInput.client";
import Input from "@/app/components/ui/Input";
import { useToast } from "@/app/components/ui/ToastProvider.client";

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
  const { showToast } = useToast();

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
      showToast({ variant: "error", title: "Upload incomplete", description: "Please upload all required documents." });
      return;
    }

    if (!isProofIssueDateValid(proofOfResidenceIssuedAt)) {
      setError("Proof of residence must be issued within the last 3 months.");
      showToast({ variant: "error", title: "Invalid issue date", description: "Proof of residence must be issued within the last 3 months." });
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
            showToast({ variant: "error", title: "File too large", description: "Max 8MB per document." });
          } else if (json.error.includes("Only images or PDF uploads are supported")) {
            setError("Unsupported file type. Only images or PDF allowed.");
            showToast({ variant: "error", title: "Unsupported file type", description: "Only images or PDF are supported." });
          } else if (json.error.toLowerCase().includes("bucket") || json.error.toLowerCase().includes("not found")) {
            setError("Storage bucket not found. Please contact support.");
            showToast({ variant: "error", title: "Storage unavailable", description: "Please contact support and retry." });
          } else {
            setError(json.error);
            showToast({ variant: "error", title: "Upload failed", description: json.error });
          }
        } else {
          setError("Upload failed. Please try again.");
          showToast({ variant: "error", title: "Upload failed", description: "Please try again." });
        }
        return;
      }

      showToast({ variant: "success", title: "Documents uploaded", description: "Your verification pack was submitted successfully." });

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
          showToast({ variant: "error", title: "File too large", description: "Max 8MB per document." });
        } else if (err.message.includes("Only images or PDF uploads are supported")) {
          setError("Unsupported file type. Only images or PDF allowed.");
          showToast({ variant: "error", title: "Unsupported file type", description: "Only images or PDF are supported." });
        } else if (err.message.toLowerCase().includes("bucket") || err.message.toLowerCase().includes("not found")) {
          setError("Storage bucket not found. Please contact support.");
          showToast({ variant: "error", title: "Storage unavailable", description: "Please contact support and retry." });
        } else {
          setError(err.message);
          showToast({ variant: "error", title: "Upload failed", description: err.message });
        }
      } else {
        setError("Upload failed. Please try again.");
        showToast({ variant: "error", title: "Upload failed", description: "Please try again." });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Document checklist</div>
            <div className="text-xs text-foreground/60">Upload all items to complete profile verification.</div>
          </div>
          <div className="text-xs text-foreground/60">Accepted: images + PDF (proof of residence)</div>
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

        <div className="rounded-lg border border-border bg-card p-3 text-sm space-y-2">
          <FileDropInput
            name="profilePhoto"
            label="Profile photo"
            helper="Face/portrait photo"
            accept="image/*"
            required
            onFileSelected={setProfilePhoto}
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-3 text-sm space-y-2">
          <FileDropInput
            name="idDocument"
            label="ID document"
            helper="ID or passport image"
            accept="image/*,application/pdf"
            required
            onFileSelected={setIdDocument}
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-3 text-sm space-y-2">
          <FileDropInput
            name="driversLicense"
            label="Driver's license"
            helper="Front/back in one image or PDF"
            accept="image/*,application/pdf"
            required
            onFileSelected={setDriversLicense}
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-3 text-sm space-y-3">
          <FileDropInput
            name="proofOfResidence"
            label="Proof of residence"
            helper="Utility bill or bank statement not older than 3 months"
            accept="image/*,application/pdf"
            required
            onFileSelected={setProofOfResidence}
          />
          <div className="max-w-xs">
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

      {error ? (
        <div className="space-y-2">
          <div className="text-sm text-red-600">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs text-foreground/70 underline decoration-border"
          >
            Dismiss message
          </button>
        </div>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Uploading..." : "Submit for verification"}
      </Button>

      <div className="text-xs text-foreground/60">Max 8MB each. Verification usually takes up to 24 hours.</div>
    </form>
  );
}
