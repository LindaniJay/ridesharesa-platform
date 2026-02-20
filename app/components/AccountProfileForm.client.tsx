"use client";

import { useState } from "react";

import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";

export default function AccountProfileForm(props: {
  initialName: string;
  initialSurname: string;
  successHref?: string;
  nextHref?: string;
}) {
  const [name, setName] = useState(props.initialName);
  const [surname, setSurname] = useState(props.initialSurname);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, surname }),
      });

      const json = (await res.json().catch(() => null)) as null | { ok?: boolean; error?: string };

      if (res.status === 401) {
        const next = props.nextHref ? encodeURIComponent(props.nextHref) : "";
        window.location.href = next ? `/sign-in?next=${next}` : "/sign-in";
        return;
      }

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Could not update profile.");
        return;
      }

      if (props.successHref) {
        window.location.href = props.successHref;
      } else {
        window.location.reload();
      }
    } catch {
      setError("Could not update profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-sm">Name</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" />
        </label>
        <label className="block">
          <div className="mb-1 text-sm">Surname</div>
          <Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Last name" />
        </label>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
