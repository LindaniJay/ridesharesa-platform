"use client";

import { useMemo, useState } from "react";
import type { BookingStatus } from "@prisma/client";

import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";
import { useToast } from "@/app/components/ui/ToastProvider.client";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function BookingActions(props: {
  bookingId: string;
  currentEndDateISO: string;
  startDateISO: string;
  status: BookingStatus;
}) {
  const endpoint = useMemo(() => `/api/bookings/${encodeURIComponent(props.bookingId)}/messages`, [props.bookingId]);
  const cancelEndpoint = useMemo(() => `/api/bookings/${encodeURIComponent(props.bookingId)}/cancel`, [props.bookingId]);

  const currentEnd = new Date(props.currentEndDateISO);
  const now = new Date();

  const canCancel =
    !Number.isNaN(currentEnd.getTime()) &&
    currentEnd > now &&
    (props.status === "PENDING_PAYMENT" || props.status === "PENDING_APPROVAL" || props.status === "CONFIRMED");

  const canManageReturn = props.status === "CONFIRMED";

  const defaultExtension = Number.isNaN(currentEnd.getTime())
    ? isoDate(new Date())
    : isoDate(new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000));

  const [extensionEnd, setExtensionEnd] = useState(defaultExtension);
  const [extensionNote, setExtensionNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [sending, setSending] = useState<null | "extension" | "cancel">(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const { showToast } = useToast();

  async function sendMessage(body: string) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const json = (await res.json().catch(() => null)) as null | { error?: string };
    if (!res.ok) throw new Error(json?.error || "Failed to send request");
  }

  async function cancelBooking() {
    setSending("cancel");
    setError(null);
    setSent(null);
    try {
      const note = cancelReason.trim();
      if (note) {
        const msg = [
          "REQUEST: CANCELLATION",
          `Reason: ${note}`,
        ].join("\n");
        await sendMessage(msg);
      }

      const res = await fetch(cancelEndpoint, { method: "POST" });
      const json = (await res.json().catch(() => null)) as null | { error?: string };
      if (!res.ok) throw new Error(json?.error || "Failed to cancel booking");

      setSent("Booking cancelled successfully.");
      showToast({ variant: "success", title: "Booking cancelled" });
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to cancel booking";
      setError(msg);
      showToast({ variant: "error", title: "Cancellation failed", description: msg });
    } finally {
      setSending(null);
    }
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
      showToast({ variant: "success", title: "Extension request sent" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send extension request";
      setError(msg);
      showToast({ variant: "error", title: "Extension failed", description: msg });
    } finally {
      setSending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking actions</CardTitle>
        <CardDescription>
          Cancel your booking or request a trip extension.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        {sent ? <div className="text-sm text-foreground/70">{sent}</div> : null}

        {canCancel ? (
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-sm font-medium">Cancel this booking (including active trips)</div>
            <div className="mt-1 text-xs text-foreground/60">
              You can cancel while upcoming or currently active. We notify the host/admin automatically.
            </div>
            <div className="mt-2">
              <div className="mb-1 text-xs text-foreground/60">Reason (optional)</div>
              <Textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why are you cancelling?"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCancelConfirm(true)}
                disabled={sending !== null}
              >
                {sending === "cancel" ? "Cancelling..." : "Cancel booking"}
              </Button>
            </div>
          </div>
        ) : null}

        {canManageReturn ? (
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-sm font-medium">Request extension</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-xs text-foreground/60">New end date</div>
                <Input type="date" value={extensionEnd} onChange={(e) => setExtensionEnd(e.target.value)} />
              </label>
              <div className="sm:col-span-2">
                <div className="mb-1 text-xs text-foreground/60">Note (optional)</div>
                <Textarea rows={2} value={extensionNote} onChange={(e) => setExtensionNote(e.target.value)} placeholder="Reason / time details..." />
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <Button type="button" onClick={requestExtension} disabled={sending !== null || !extensionEnd.trim()}>
                {sending === "extension" ? "Sending..." : "Send extension request"}
              </Button>
            </div>
          </div>
        ) : null}

        {showCancelConfirm ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl">
              <div className="text-base font-semibold">Confirm cancellation</div>
              <div className="mt-1 text-sm text-foreground/70">
                This action will cancel the booking and notify the host/admin immediately.
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowCancelConfirm(false)}>
                  Keep booking
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    setShowCancelConfirm(false);
                    await cancelBooking();
                  }}
                  disabled={sending !== null}
                >
                  Confirm cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
