"use client";

import { useMemo, useState } from "react";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";
import { useToast } from "@/app/components/ui/ToastProvider.client";

type ReturnPhoto = { name: string; signedUrl: string };

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < rating;
    return (
      <svg
        key={i}
        viewBox="0 0 24 24"
        className={filled ? "h-5 w-5 fill-amber-400 text-amber-400" : "h-5 w-5 fill-transparent text-amber-300"}
      >
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          d="M12 3l2.8 5.67 6.26.91-4.53 4.42 1.07 6.24L12 17.27 6.4 20.24l1.07-6.24L2.94 9.58l6.26-.91L12 3z"
        />
      </svg>
    );
  });
}

export default function ReturnWorkflow(props: {
  bookingId: string;
  vehicleTitle: string;
  endDateISO: string;
  startDateISO: string;
  isCancelled: boolean;
  viewerRole: "RENTER" | "HOST" | "ADMIN";
  renterReturnPhotos: ReturnPhoto[];
  hostReturnPhotos: ReturnPhoto[];
  existingReview: { rating: number; comment: string | null } | null;
}) {
  const endDate = new Date(props.endDateISO);
  const now = new Date();
  const isOverdue = now > endDate;
  const daysOverdue = isOverdue ? Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const isRenter = props.viewerRole === "RENTER";
  const isHost = props.viewerRole === "HOST" || props.viewerRole === "ADMIN";

  const messageEndpoint = useMemo(() => `/api/bookings/${encodeURIComponent(props.bookingId)}/messages`, [props.bookingId]);
  const reviewEndpoint = useMemo(() => `/api/bookings/${encodeURIComponent(props.bookingId)}/review`, [props.bookingId]);

  const hasRenterPhotos = props.renterReturnPhotos.length > 0;
  const hasHostPhotos = props.hostReturnPhotos.length > 0;

  const [checklist, setChecklist] = useState({
    fuelChecked: false,
    belongingsRemoved: false,
    photosUploaded: false,
    keysReturned: false,
  });

  const allChecked = checklist.fuelChecked && checklist.belongingsRemoved && checklist.photosUploaded && checklist.keysReturned;
  const returnComplete = allChecked && hasRenterPhotos && hasHostPhotos;

  const [returnDate, setReturnDate] = useState(() => {
    const start = new Date(props.startDateISO);
    return Number.isNaN(start.getTime()) ? new Date().toISOString().slice(0, 10) : start.toISOString().slice(0, 10);
  });
  const [returnNote, setReturnNote] = useState("");

  const [reviewRating, setReviewRating] = useState(String(props.existingReview?.rating ?? 5));
  const [reviewComment, setReviewComment] = useState(props.existingReview?.comment ?? "");
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [sending, setSending] = useState<null | "return" | "review">(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const { showToast } = useToast();

  async function sendReturnRequest() {
    setSending("return");
    setError(null);
    setSent(null);
    try {
      if (!checklist.fuelChecked || !checklist.belongingsRemoved || !checklist.photosUploaded || !checklist.keysReturned) {
        throw new Error("Complete the return checklist before sending a return request.");
      }

      const note = returnNote.trim();
      const msg = [
        "REQUEST: VEHICLE RETURN",
        `Preferred return date: ${returnDate}`,
        "Checklist: fuel confirmed, belongings removed, return photos uploaded, keys ready.",
        "Please confirm the drop-off location and inspection time.",
        note ? `Note: ${note}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch(messageEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: msg }),
      });
      const json = (await res.json().catch(() => null)) as null | { error?: string };
      if (!res.ok) throw new Error(json?.error || "Failed to send return request");

      setReturnNote("");
      setSent("Return request sent. The host will confirm via chat.");
      showToast({ variant: "success", title: "Return request sent" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send return request";
      setError(msg);
      showToast({ variant: "error", title: "Return request failed", description: msg });
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
        body: JSON.stringify({ rating, comment: reviewComment }),
      });
      const json = (await res.json().catch(() => null)) as null | { error?: string };
      if (!res.ok) throw new Error(json?.error || "Failed to submit review");

      setSent("Review saved.");
      showToast({ variant: "success", title: "Review saved" });
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit review";
      setError(msg);
      showToast({ variant: "error", title: "Review failed", description: msg });
    } finally {
      setSending(null);
    }
  }

  const canReview = isRenter && !props.isCancelled;

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div>
            <CardTitle>Return workflow</CardTitle>
            <CardDescription>
              {props.isCancelled
                ? "This booking was cancelled. If the vehicle was already collected, complete the return process below."
                : isOverdue
                  ? `Trip ended ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago — please return ${props.vehicleTitle} promptly.`
                  : `Trip ends ${endDate.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}. Start preparing the return.`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <div className="text-sm text-destructive">{error}</div>}
        {sent && <div className="text-sm text-foreground/70">{sent}</div>}

        {isOverdue && !props.isCancelled && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
            <span className="font-bold">⚠</span>
            <span>This vehicle is <strong>{daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue</strong>. Please return it as soon as possible or request an extension via chat.</span>
          </div>
        )}

        {/* Timeline */}
        <div className="relative pl-6">
          <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />

          {/* Step 1: Return checklist */}
          <div className="relative pb-5">
            <div className={`absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 ${allChecked ? "border-green-500 bg-green-500" : "border-emerald-500 bg-card"}`} />
            <div className="text-sm font-semibold">Return checklist</div>
            <div className="mt-1 text-xs text-foreground/60">Complete these before handing back the vehicle.</div>
            <div className="mt-3 rounded-xl border border-border bg-card/80 p-3 space-y-2">
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-emerald-500"
                  checked={checklist.fuelChecked}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, fuelChecked: e.target.checked }))}
                />
                <div>
                  <div className="font-medium text-foreground/90">Fuel level verified</div>
                  <div className="text-xs text-foreground/50">Return with the same fuel level as pickup (or as agreed with host).</div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-emerald-500"
                  checked={checklist.belongingsRemoved}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, belongingsRemoved: e.target.checked }))}
                />
                <div>
                  <div className="font-medium text-foreground/90">Personal belongings removed</div>
                  <div className="text-xs text-foreground/50">Check boot, glovebox, and under seats.</div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-emerald-500"
                  checked={checklist.photosUploaded}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, photosUploaded: e.target.checked }))}
                />
                <div>
                  <div className="font-medium text-foreground/90">Return photos uploaded</div>
                  <div className="text-xs text-foreground/50">Exterior, interior, fuel gauge, and odometer.</div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-emerald-500"
                  checked={checklist.keysReturned}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, keysReturned: e.target.checked }))}
                />
                <div>
                  <div className="font-medium text-foreground/90">Keys &amp; access cards ready</div>
                  <div className="text-xs text-foreground/50">Have all keys, cards, and remotes ready for handover.</div>
                </div>
              </label>

              {allChecked && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-xs text-green-700 dark:text-green-400">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Return checklist complete.
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Renter return photos */}
          <div className="relative pb-5">
            <div className={`absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 ${hasRenterPhotos ? "border-green-500 bg-green-500" : "border-border bg-card"}`} />
            <div className="text-sm font-semibold">Renter return photos</div>
            <div className="mt-1 text-xs text-foreground/60">Upload photos showing the vehicle condition at return.</div>
            {isRenter && (
              <form
                action={`/api/bookings/${encodeURIComponent(props.bookingId)}/photos`}
                method="post"
                encType="multipart/form-data"
                className="mt-3 rounded-xl border border-border bg-card/80 p-3 space-y-2"
              >
                <input type="hidden" name="kind" value="renter_return" />
                <label className="block text-sm font-medium">Upload return photo</label>
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  required
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-600 dark:file:text-emerald-400 hover:file:bg-emerald-500/20"
                />
                <Button type="submit" variant="secondary">Upload</Button>
              </form>
            )}
            {hasRenterPhotos && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {props.renterReturnPhotos.map((p) => (
                  <a key={p.name} href={p.signedUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.signedUrl} alt="Renter return" className="h-32 w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                    <div className="border-t border-border p-1.5 text-xs text-foreground/50">Return photo</div>
                  </a>
                ))}
              </div>
            )}
            {!hasRenterPhotos && !isRenter && (
              <div className="mt-2 text-xs text-foreground/50">Waiting for renter to upload return photos.</div>
            )}
          </div>

          {/* Step 3: Host return inspection */}
          <div className="relative pb-5">
            <div className={`absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 ${hasHostPhotos ? "border-green-500 bg-green-500" : "border-border bg-card"}`} />
            <div className="text-sm font-semibold">Host return inspection</div>
            <div className="mt-1 text-xs text-foreground/60">Host inspects and photographs the vehicle after receiving it back.</div>
            {isHost && (
              <form
                action={`/api/bookings/${encodeURIComponent(props.bookingId)}/photos`}
                method="post"
                encType="multipart/form-data"
                className="mt-3 rounded-xl border border-border bg-card/80 p-3 space-y-2"
              >
                <input type="hidden" name="kind" value="host_return" />
                <label className="block text-sm font-medium">Upload inspection photo</label>
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  required
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-600 dark:file:text-emerald-400 hover:file:bg-emerald-500/20"
                />
                <Button type="submit" variant="secondary">Upload</Button>
              </form>
            )}
            {hasHostPhotos && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {props.hostReturnPhotos.map((p) => (
                  <a key={p.name} href={p.signedUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.signedUrl} alt="Host inspection" className="h-32 w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                    <div className="border-t border-border p-1.5 text-xs text-foreground/50">Inspection photo</div>
                  </a>
                ))}
              </div>
            )}
            {!hasHostPhotos && !isHost && (
              <div className="mt-2 text-xs text-foreground/50">Waiting for host to complete return inspection.</div>
            )}
          </div>

          {/* Step 4: Send return request */}
          {isRenter && !props.isCancelled && (
            <div className="relative pb-5">
              <div className={`absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 border-border bg-card`} />
              <div className="text-sm font-semibold">Request return handover</div>
              <div className="mt-1 text-xs text-foreground/60">Send details to the host so they can confirm the drop-off.</div>
              <div className="mt-3 rounded-xl border border-border bg-card/80 p-3 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-foreground/60">Preferred return date</div>
                    <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                  </label>
                  <div className="sm:col-span-2">
                    <div className="mb-1 text-xs font-medium text-foreground/60">Note (optional)</div>
                    <Textarea rows={2} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="Drop-off location or time preferences..." />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={sendReturnRequest}
                    disabled={sending !== null || !returnDate.trim() || !allChecked}
                  >
                    {sending === "return" ? "Sending..." : "Send return request"}
                  </Button>
                </div>
                {!allChecked && (
                  <div className="text-xs text-amber-600 dark:text-amber-400">Complete the return checklist before sending.</div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {canReview && (
            <div className="relative">
              <div className={`absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 ${props.existingReview ? "border-green-500 bg-green-500" : "border-border bg-card"}`} />
              <div className="text-sm font-semibold">Rate your experience</div>
              <div className="mt-1 text-xs text-foreground/60">Leave a review for the host and vehicle.</div>

              {props.existingReview ? (
                <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">{renderStars(props.existingReview.rating)}</div>
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{props.existingReview.rating}/5</span>
                  </div>
                  {props.existingReview.comment && (
                    <div className="mt-1 text-sm text-foreground/70">{props.existingReview.comment}</div>
                  )}
                  <Button type="button" variant="secondary" className="mt-2" onClick={() => setShowReviewModal(true)}>
                    Edit review
                  </Button>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-border bg-card/80 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">{renderStars(Number(reviewRating) || 5)}</div>
                    <Button type="button" onClick={() => setShowReviewModal(true)}>
                      Rate with stars
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Completion status */}
        {returnComplete ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3">
            <Badge variant="success">Return complete</Badge>
            <div className="text-sm text-green-700 dark:text-green-400">
              {props.vehicleTitle} has been returned and inspected. {props.existingReview ? "Your review has been submitted." : "Don't forget to leave a review!"}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <Badge variant="warning">In progress</Badge>
            <div className="text-sm text-amber-700 dark:text-amber-400">
              {!allChecked
                ? "Complete the return checklist to proceed."
                : !hasRenterPhotos
                  ? "Renter needs to upload return photos."
                  : "Waiting for host inspection photos."}
            </div>
          </div>
        )}

        {/* Review modal */}
        {showReviewModal && canReview && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold">Trip review</div>
                  <div className="mt-1 text-xs text-foreground/60">Rate the host and vehicle, and leave optional feedback.</div>
                </div>
                <Button type="button" variant="secondary" onClick={() => setShowReviewModal(false)}>
                  Close
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-2 text-xs font-medium text-foreground/60">Rating</div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, index) => {
                      const value = index + 1;
                      const selected = value <= Number(reviewRating || "0");
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
                          onClick={() => setReviewRating(String(value))}
                          className="rounded-md p-1 transition-transform hover:scale-110"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className={selected ? "h-8 w-8 fill-amber-400 text-amber-400" : "h-8 w-8 fill-transparent text-amber-300"}
                          >
                            <path
                              stroke="currentColor"
                              strokeWidth="1.5"
                              d="M12 3l2.8 5.67 6.26.91-4.53 4.42 1.07 6.24L12 17.27 6.4 20.24l1.07-6.24L2.94 9.58l6.26-.91L12 3z"
                            />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-xs text-foreground/50">Selected: {reviewRating}/5</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-foreground/60">Comment (optional)</div>
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
        )}
      </CardContent>
    </Card>
  );
}
