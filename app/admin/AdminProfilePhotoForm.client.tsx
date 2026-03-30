"use client";

import { useState } from "react";

import Button from "@/app/components/ui/Button";
import FileDropInput from "@/app/components/FileDropInput.client";
import { useToast } from "@/app/components/ui/ToastProvider.client";

export default function AdminProfilePhotoForm() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please choose an image.");
      showToast({ variant: "error", title: "No image selected", description: "Please choose an image first." });
      return;
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      setError(`Image too large (max 8MB). Yours is ${mb}MB.`);
      showToast({ variant: "error", title: "Image too large", description: `Max 8MB. Selected ${mb}MB.` });
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.set("profilePhoto", file);

      const res = await fetch("/api/account/profile-photo", {
        method: "POST",
        body: form,
      });

      const json = (await res.json().catch(() => null)) as null | { ok?: boolean; error?: string };

      if (res.status === 401) {
        window.location.href = "/sign-in?next=%2Fadmin";
        return;
      }

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Upload failed. Please try again.");
        showToast({ variant: "error", title: "Upload failed", description: json?.error || "Please try again." });
        return;
      }

      setFile(null);
      showToast({ variant: "success", title: "Profile photo updated" });
      window.location.reload();
    } catch {
      setError("Upload failed. Please try again.");
      showToast({ variant: "error", title: "Upload failed", description: "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <FileDropInput
        name="profilePhoto"
        label="Profile image"
        helper="Images only • Max 8MB"
        accept="image/*"
        required
        onFileSelected={setFile}
      />
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      <Button type="submit" variant="secondary" disabled={loading} className="w-full">
        {loading ? "Uploading…" : "Update profile photo"}
      </Button>
    </form>
  );
}
