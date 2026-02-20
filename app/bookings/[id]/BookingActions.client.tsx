"use client";

import { useMemo, useState } from "react";

import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function BookingActions(props: {
  bookingId: string;
  currentEndDateISO: string;
}) {
  const endpoint = useMemo(() => `/api/bookings/${encodeURIComponent(props.bookingId)}/messages`, [props.bookingId]);

  const currentEnd = new Date(props.currentEndDateISO);
  const defaultExtension = Number.isNaN(currentEnd.getTime())
    ? isoDate(new Date())
    : isoDate(new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000));

  const [extensionEnd, setExtensionEnd] = useState(defaultExtension);
  const [extensionNote, setExtensionNote] = useState("");
  const [returnDate, setReturnDate] = useState(isoDate(new Date()));
  const [returnNote, setReturnNote] = useState("");

  const [sending, setSending] = useState<null | "extension" | "return">(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function sendMessage(body: string) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const json = (await res.json().catch(() => null)) as null | { error?: string };
    if (!res.ok) throw new Error(json?.error || "Failed to send request");
  }

  async function requestExtension() {
    setSending("extension");
    setError(null);
    setSent(null);
    try {
      const note = extensionNote.trim();
      const msg = [
        `REQUEST: EXTENSION`,
        `Current end: ${props.currentEndDateISO.slice(0, 10)}`,
        `Requested end: ${extensionEnd}`,
        note ? `Note: ${note}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      await sendMessage(msg);
      setExtensionNote("");
      setSent("Extension request sent. Check Messages for replies.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send extension request");
    } finally {
      setSending(null);
    }
  }

  async function requestReturn() {
    setSending("return");
    setError(null);
    setSent(null);
    try {
      const note = returnNote.trim();
      const msg = [
        `REQUEST: RETURN`,
        `Preferred return date: ${returnDate}`,
        note ? `Note: ${note}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      await sendMessage(msg);
      setReturnNote("");
      setSent("Return request sent. Check Messages for replies.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send return request");
    } finally {
      setSending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>
          Request an extension or return. Your request is sent to the booking chat so the host and admin can respond.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        {sent ? <div className="text-sm text-foreground/70">{sent}</div> : null}

        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-sm font-medium">Request extension</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs text-foreground/60">New end date</div>
              <Input type="date" value={extensionEnd} onChange={(e) => setExtensionEnd(e.target.value)} />
            </label>
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs text-foreground/60">Note (optional)</div>
              <Textarea rows={2} value={extensionNote} onChange={(e) => setExtensionNote(e.target.value)} placeholder="Reason / time details…" />
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <Button type="button" onClick={requestExtension} disabled={sending !== null || !extensionEnd.trim()}>
              {sending === "extension" ? "Sending…" : "Send extension request"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-sm font-medium">Request return</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs text-foreground/60">Preferred return date</div>
              <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </label>
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs text-foreground/60">Note (optional)</div>
              <Textarea rows={2} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="Where/when you want to return…" />
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="secondary" onClick={requestReturn} disabled={sending !== null || !returnDate.trim()}>
              {sending === "return" ? "Sending…" : "Send return request"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
