"use client";

import { useMemo, useState } from "react";
import type { BookingStatus } from "@prisma/client";

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
  startDateISO: string;
  status: BookingStatus;
  existingReview: { rating: number; comment: string | null } | null;
}) {
  const endpoint = useMemo(() => `/api/bookings/${encodeURIComponent(props.bookingId)}/messages`, [props.bookingId]);
  const cancelEndpoint = useMemo(() => `/api/bookings/${encodeURIComponent(props.bookingId)}/cancel`, [props.bookingId]);
  const reviewEndpoint = useMemo(() => `/api/bookings/${encodeURIComponent(props.bookingId)}/review`, [props.bookingId]);

  const currentEnd = new Date(props.currentEndDateISO);
  const now = new Date();

  const canCancel =
    !Number.isNaN(currentEnd.getTime()) &&
    currentEnd > now &&
    (props.status === "PENDING_PAYMENT" || props.status === "PENDING_APPROVAL" || props.status === "CONFIRMED");

  const canManageReturn = props.status === "CONFIRMED";
  const canReview =
    props.status === "CONFIRMED" &&
    !Number.isNaN(currentEnd.getTime()) &&
    currentEnd <= now;

  const defaultExtension = Number.isNaN(currentEnd.getTime())
    ? isoDate(new Date())
    : isoDate(new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000));

  const [extensionEnd, setExtensionEnd] = useState(defaultExtension);
  const [extensionNote, setExtensionNote] = useState("");
  const [returnDate, setReturnDate] = useState(() => {
    const start = new Date(props.startDateISO);
    return Number.isNaN(start.getTime()) ? isoDate(new Date()) : isoDate(start);
  });
  const [returnNote, setReturnNote] = useState("");
  const [returnChecklist, setReturnChecklist] = useState({
    fuelChecked: false,
    belongingsRemoved: false,
    photosUploaded: false,
  });
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [reviewRating, setReviewRating] = useState(String(props.existingReview?.rating ?? 5));
  const [reviewComment, setReviewComment] = useState(props.existingReview?.comment ?? "");
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [sending, setSending] = useState<null | "extension" | "return" | "cancel" | "review">(null);
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
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel booking");
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
      if (!returnChecklist.fuelChecked || !returnChecklist.belongingsRemoved || !returnChecklist.photosUploaded) {
        throw new Error("Complete the return checklist before sending a return request.");
      }

      const note = returnNote.trim();
      const msg = [
        `REQUEST: RETURN`,
        `Preferred return date: ${returnDate}`,
        "Checklist: fuel confirmed, belongings removed, renter return photos uploaded.",
        "Please confirm the drop-off location and inspection time.",
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

  async function submitReview() {
    setSending("review");
    setError(null);
    setSent(null);
    try {
      const rating = Number(reviewRating);
      const res = await fetch(reviewEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: reviewComment,
        }),
      });

      const json = (await res.json().catch(() => null)) as null | { error?: string };
      if (!res.ok) throw new Error(json?.error || "Failed to submit review");

      setSent("Review saved.");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setSending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking actions</CardTitle>
        <CardDescription>
          Cancel even while active, follow a clean return checklist, and leave your review in one place.
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
            <div className="text-sm font-medium">Return flow</div>
            <div className="mt-1 text-xs text-foreground/60">Follow this order to avoid disputes:</div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-foreground/70">
              <li>Upload renter return photos in the photo log below.</li>
              <li>Send return request with preferred date and note.</li>
              <li>Wait for host confirmation in chat and complete handover.</li>
            </ol>

            <div className="mt-3 rounded-lg border border-border bg-background p-3">
              <div className="text-sm font-medium">Return checklist</div>
              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-2 text-xs text-foreground/75">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={returnChecklist.photosUploaded}
                    onChange={(e) =>
                      setReturnChecklist((prev) => ({ ...prev, photosUploaded: e.target.checked }))
                    }
                  />
                  Renter return photos uploaded (exterior/interior/fuel/odometer as needed).
                </label>
                <label className="flex items-start gap-2 text-xs text-foreground/75">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={returnChecklist.fuelChecked}
                    onChange={(e) =>
                      setReturnChecklist((prev) => ({ ...prev, fuelChecked: e.target.checked }))
                    }
                  />
                  Fuel level and mileage checked against pickup condition.
                </label>
                <label className="flex items-start gap-2 text-xs text-foreground/75">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={returnChecklist.belongingsRemoved}
                    onChange={(e) =>
                      setReturnChecklist((prev) => ({ ...prev, belongingsRemoved: e.target.checked }))
                    }
                  />
                  Personal belongings removed and keys/cards ready for handover.
                </label>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-border bg-background p-3">
              <div className="text-sm font-medium">Request return</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs text-foreground/60">Preferred return date</div>
                  <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </label>
                <div className="sm:col-span-2">
                  <div className="mb-1 text-xs text-foreground/60">Note (optional)</div>
                  <Textarea rows={2} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="Where/when you want to return..." />
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={requestReturn}
                  disabled={
                    sending !== null ||
                    !returnDate.trim() ||
                    !returnChecklist.photosUploaded ||
                    !returnChecklist.fuelChecked ||
                    !returnChecklist.belongingsRemoved
                  }
                >
                  {sending === "return" ? "Sending..." : "Send return request"}
                </Button>
              </div>
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

        {canReview ? (
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">Rate your trip</div>
                <div className="mt-1 text-xs text-foreground/60">Open the review popup to submit rating and feedback.</div>
              </div>
              <Button type="button" onClick={() => setShowReviewModal(true)}>
                {props.existingReview ? "Edit review" : "Open review popup"}
              </Button>
            </div>
          </div>
        ) : props.existingReview ? (
          <div className="rounded-xl border border-border bg-card p-3 text-sm">
            <div className="font-medium">Review submitted</div>
            <div className="mt-1 text-foreground/70">Rating: {props.existingReview.rating}/5</div>
            {props.existingReview.comment ? <div className="mt-1 text-foreground/70">{props.existingReview.comment}</div> : null}
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

        {showReviewModal && canReview ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold">Trip review</div>
                  <div className="mt-1 text-xs text-foreground/60">Rate the host and leave optional feedback.</div>
                </div>
                <Button type="button" variant="secondary" onClick={() => setShowReviewModal(false)}>
                  Close
                </Button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs text-foreground/60">Rating</div>
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(e.target.value)}
                    className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
                  >
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Okay</option>
                    <option value="2">2 - Poor</option>
                    <option value="1">1 - Bad</option>
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <div className="mb-1 text-xs text-foreground/60">Comment (optional)</div>
                  <Textarea
                    rows={4}
                    maxLength={1000}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="How was the vehicle condition and host communication?"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowReviewModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    await submitReview();
                    setShowReviewModal(false);
                  }}
                  disabled={sending !== null}
                >
                  {sending === "review" ? "Saving..." : props.existingReview ? "Update review" : "Submit review"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
