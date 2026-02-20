"use client";

import { useRef, useState } from "react";

import Button from "@/app/components/ui/Button";

export default function HostProfilePhotoForm() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please choose an image.");
      return;
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      setError(`Image too large (max 8MB). Yours is ${mb}MB.`);
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
        window.location.href = "/sign-in?next=%2Fhost";
        return;
      }

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Upload failed. Please try again.");
        return;
      }

      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      window.location.reload();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="shrink-0"
        >
          Choose image
        </Button>
        <div className="min-w-0 text-sm text-foreground/60">
          {file ? <span className="truncate">{file.name}</span> : <span>No image selected</span>}
        </div>
      </div>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      <Button type="submit" variant="secondary" disabled={loading} className="w-full">
        {loading ? "Uploading…" : "Update profile photo"}
      </Button>
      <div className="text-xs text-foreground/60">Images only • Max 8MB</div>
    </form>
  );
}
