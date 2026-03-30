import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import FileDropInput from "@/app/components/FileDropInput.client";
import { badgeVariantForBookingStatus } from "@/app/lib/badgeVariants";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import BookingStatusClient from "@/app/bookings/[id]/BookingStatusClient";
import BookingActions from "@/app/bookings/[id]/BookingActions.client";
import BookingChat from "@/app/bookings/[id]/BookingChat.client";

type BookingPhotoKind = "host_handover" | "renter_pickup" | "renter_return" | "host_return";

type PaymentProofKind = "payment_proof";

const PHOTO_KINDS: Array<{ kind: BookingPhotoKind; label: string; helper: string }> = [
  { kind: "host_handover", label: "Host handover", helper: "Host uploads proof before pickup." },
  { kind: "renter_pickup", label: "Renter pickup", helper: "Renter uploads proof at pickup." },
  { kind: "renter_return", label: "Renter return", helper: "Renter uploads proof at return." },
  { kind: "host_return", label: "Host return inspection", helper: "Host uploads inspection after return." },
];

type BookingLifecycleStep = "BOOKED" | "PICKUP" | "ACTIVE" | "RETURN" | "REVIEWED";

function deriveBookingLifecycleStep(params: {
  status: "PENDING_PAYMENT" | "PENDING_APPROVAL" | "CONFIRMED" | "CANCELLED";
  now: Date;
  startDate: Date;
  endDate: Date;
  hasReview: boolean;
}): BookingLifecycleStep {
  if (params.status === "CANCELLED") return "BOOKED";
  if (params.status !== "CONFIRMED") return "BOOKED";
  if (params.now < params.startDate) return "PICKUP";
  if (params.now <= params.endDate) return "ACTIVE";
  if (params.hasReview) return "REVIEWED";
  return "RETURN";
}

async function listSignedBookingPhotos(params: { bookingId: string; kind: BookingPhotoKind }) {
  const bucket = process.env.SUPABASE_BOOKING_PHOTOS_BUCKET || "booking-photos";
  const admin = supabaseAdmin();

  const { data, error } = await admin.storage.from(bucket).list(`${params.bookingId}/${params.kind}`, {
    limit: 50,
    offset: 0,
    sortBy: { column: "name", order: "desc" },
  });

  if (error) {
    return { ok: false as const, bucket, error: error.message, photos: [] as Array<{ name: string; signedUrl: string }> };
  }

  const objects = data ?? [];
  const photos: Array<{ name: string; signedUrl: string }> = [];
  for (const o of objects) {
    if (!o.name) continue;
    const path = `${params.bookingId}/${params.kind}/${o.name}`;
    const signed = await admin.storage.from(bucket).createSignedUrl(path, 60 * 10);
    if (signed.data?.signedUrl) {
      photos.push({ name: o.name, signedUrl: signed.data.signedUrl });
    }
  }

  return { ok: true as const, bucket, error: null as string | null, photos };
}

async function listSignedPaymentProofs(params: { bookingId: string; kind: PaymentProofKind }) {
  const bucket = process.env.SUPABASE_BOOKING_PHOTOS_BUCKET || "booking-photos";
  const admin = supabaseAdmin();

  const { data, error } = await admin.storage.from(bucket).list(`${params.bookingId}/${params.kind}`, {
    limit: 20,
    offset: 0,
    sortBy: { column: "name", order: "desc" },
  });

  if (error) {
    return { ok: false as const, bucket, error: error.message, proofs: [] as Array<{ name: string; signedUrl: string }> };
  }

  const objects = data ?? [];
  const proofs: Array<{ name: string; signedUrl: string }> = [];
  for (const o of objects) {
    if (!o.name) continue;
    const path = `${params.bookingId}/${params.kind}/${o.name}`;
    const signed = await admin.storage.from(bucket).createSignedUrl(path, 60 * 10);
    if (signed.data?.signedUrl) {
      proofs.push({ name: o.name, signedUrl: signed.data.signedUrl });
    }
  }

  return { ok: true as const, bucket, error: null as string | null, proofs };
}

type BookingPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseIntParam(v: unknown) {
  if (typeof v !== "string") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (String(i) !== v.trim()) return i;
  return i;
}

function formatMoney(cents: number, currency: string) {
  const value = Math.max(0, cents) / 100;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function BookingPage({
  params,
  searchParams,
}: BookingPageProps) {
  const { dbUser } = await requireUser();
  const viewerRole = dbUser.role;
  const viewerId = dbUser.id;

  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const chauffeurKmRaw = Array.isArray(resolvedSearchParams?.chauffeurKm)
    ? resolvedSearchParams?.chauffeurKm[0]
    : resolvedSearchParams?.chauffeurKm;
  const paymentProofParamRaw = Array.isArray(resolvedSearchParams?.paymentProof)
    ? resolvedSearchParams?.paymentProof[0]
    : resolvedSearchParams?.paymentProof;
  const paymentProofParam = typeof paymentProofParamRaw === "string" ? paymentProofParamRaw : null;
  const chauffeurKmParsed = parseIntParam(chauffeurKmRaw);
  const chauffeurKm = chauffeurKmParsed && chauffeurKmParsed > 0 ? Math.min(chauffeurKmParsed, 5000) : 0;
  const chauffeurRateCentsPerKm = 10 * 100;
  const chauffeurCents = chauffeurKm > 0 ? chauffeurKm * chauffeurRateCentsPerKm : 0;

  const booking = await prisma.booking.findUnique({
    where: { id: resolvedParams.id },
    select: {
      id: true,
      status: true,
      paymentReference: true,
      stripeCheckoutSessionId: true,
      days: true,
      totalCents: true,
      currency: true,
      renterId: true,
      startDate: true,
      endDate: true,
      listing: {
        select: {
          id: true,
          title: true,
          city: true,
          imageUrl: true,
          dailyRateCents: true,
          hostId: true,
        },
      },
    },
  });

  if (!booking) notFound();
  const canView =
    viewerRole === "ADMIN" ||
    booking.renterId === viewerId ||
    (viewerRole === "HOST" && booking.listing.hostId === viewerId);
  if (!canView) redirect("/listings");

  const isAdmin = viewerRole === "ADMIN";
  const isHost = viewerRole === "HOST" && booking.listing.hostId === viewerId;
  const isRenter = viewerRole === "RENTER" && booking.renterId === viewerId;

  const existingRenterReview = isRenter
    ? await prisma.review.findFirst({
        where: {
          bookingId: booking.id,
          authorId: viewerId,
        },
        select: {
          rating: true,
          comment: true,
        },
      })
    : null;

  const totalReviewsForBooking = await prisma.review.count({
    where: { bookingId: booking.id },
  });

  const lifecycleOrder: BookingLifecycleStep[] = ["BOOKED", "PICKUP", "ACTIVE", "RETURN", "REVIEWED"];
  const lifecycleLabel: Record<BookingLifecycleStep, string> = {
    BOOKED: "Booked",
    PICKUP: "Pickup",
    ACTIVE: "Active",
    RETURN: "Return",
    REVIEWED: "Reviewed",
  };

  const lifecycleCurrent = deriveBookingLifecycleStep({
    status: booking.status,
    now: new Date(),
    startDate: booking.startDate,
    endDate: booking.endDate,
    hasReview: totalReviewsForBooking > 0,
  });
  const lifecycleCurrentIndex = lifecycleOrder.indexOf(lifecycleCurrent);

  const photosByKind = await Promise.all(
    PHOTO_KINDS.map(async ({ kind }) => ({
      kind,
      result: await listSignedBookingPhotos({ bookingId: booking.id, kind }),
    })),
  );

  const isPendingPayment = booking.status === "PENDING_PAYMENT";
  const isPendingApproval = booking.status === "PENDING_APPROVAL";
  const isPending = isPendingPayment || isPendingApproval;
  const isManualPayment = isPendingPayment && !booking.stripeCheckoutSessionId;

  const paymentProofRes = isManualPayment && (isAdmin || isRenter)
    ? await listSignedPaymentProofs({ bookingId: booking.id, kind: "payment_proof" })
    : null;
  const hasPaymentProof = Boolean(paymentProofRes?.ok && paymentProofRes.proofs.length > 0);

  const rentalCents = Math.max(0, booking.totalCents - chauffeurCents);

  const eft = {
    bankName: process.env.EFT_BANK_NAME ?? "",
    accountName: process.env.EFT_ACCOUNT_NAME ?? "",
    accountNumber: process.env.EFT_ACCOUNT_NUMBER ?? "",
    branchCode: process.env.EFT_BRANCH_CODE ?? "",
  };
  const hasEftDetails = Boolean(
    eft.bankName.trim() &&
      eft.accountName.trim() &&
      eft.accountNumber.trim() &&
      eft.branchCode.trim(),
  );

  const heading =
    booking.status === "CONFIRMED"
      ? "Booking confirmed"
      : booking.status === "CANCELLED"
        ? "Booking cancelled"
        : booking.status === "PENDING_APPROVAL"
          ? "Booking awaiting admin approval"
          : "Booking pending";

  const subheading =
    booking.status === "CONFIRMED"
      ? "Your reservation is confirmed."
      : booking.status === "CANCELLED"
        ? "This booking has been cancelled."
        : booking.status === "PENDING_APPROVAL"
          ? "Payment was received. An admin must approve this booking before it is confirmed."
          : isManualPayment
            ? "Complete payment via Instant EFT so an admin can confirm it."
            : "Payment is processing. This page will update after Stripe confirms payment.";

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-8 mobile-tight stagger-children">
      <div className="text-sm text-black/60 dark:text-white/60">
        <Link className="underline" href="/listings">
          Listings
        </Link>
        <span className="px-2">/</span>
        <Link className="underline" href={`/listings/${booking.listing.id}`}>
          {booking.listing.title}
        </Link>
        <span className="px-2">/</span>
        <span className="text-black/80 dark:text-white/80">Booking</span>
      </div>

      <Card className="overflow-hidden border-border/80">
        <CardContent className="grid gap-4 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-6">
          <div className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
              <p className="text-sm text-foreground/60">{subheading}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={badgeVariantForBookingStatus(booking.status)}>{booking.status}</Badge>
              {booking.paymentReference ? (
                <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground/70">
                  Ref {booking.paymentReference}
                </span>
              ) : null}
              <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground/70">
                {booking.days} {booking.days === 1 ? "day" : "days"}
              </span>
            </div>
            <BookingStatusClient status={booking.status} method={isManualPayment ? "manual" : "stripe"} />
          </div>

          {booking.listing.imageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={booking.listing.imageUrl}
                alt={booking.listing.title}
                className="h-44 w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex h-44 items-center justify-center rounded-2xl border border-border bg-muted text-sm text-foreground/60">
              No vehicle image
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Trip dates</CardTitle>
            <CardDescription>{booking.startDate.toISOString().slice(0, 10)} to {booking.endDate.toISOString().slice(0, 10)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vehicle</CardTitle>
            <CardDescription>{booking.listing.title} in {booking.listing.city}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total due</CardTitle>
            <CardDescription>{formatMoney(booking.totalCents, booking.currency)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Daily rate</CardTitle>
            <CardDescription>{formatMoney(booking.listing.dailyRateCents, booking.currency)} / day</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Promo code input */}
      <Card>
        <CardHeader>
          <CardTitle>Promo Code</CardTitle>
          <CardDescription>Enter a promo code for discounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="POST" action="/api/bookings/apply-promo" className="flex items-center gap-2">
            <input type="hidden" name="bookingId" value={booking.id} />
            <input
              name="promoCode"
              type="text"
              placeholder="Enter code"
              className="rounded-md border border-border px-2 py-1 text-sm text-foreground bg-card outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            />
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
        </CardContent>
      </Card>

      {/* Insurance info section */}
      <Card>
        <CardHeader>
          <CardTitle>Insurance & Protection</CardTitle>
          <CardDescription>
            Every trip includes basic liability insurance and 24/7 roadside assistance. Optional premium coverage is available at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ul className="list-disc pl-5">
            <li>Basic liability insurance included for renter and host</li>
            <li>Optional premium coverage for higher limits and lower excess</li>
            <li>24/7 roadside assistance for breakdowns and emergencies</li>
            <li>See <Link href="/terms">terms</Link> for full details</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trip progress</CardTitle>
          <CardDescription>Track where this booking is in the trip lifecycle.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 sm:grid-cols-5">
            {lifecycleOrder.map((step, idx) => {
              const completed = idx <= lifecycleCurrentIndex;
              const active = idx === lifecycleCurrentIndex;
              return (
                <li
                  key={step}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm",
                    completed ? "border-accent/40 bg-accent-soft text-foreground" : "border-border bg-card/60 text-foreground/60",
                    active ? "ring-1 ring-accent/40" : "",
                  ].join(" ")}
                >
                  <div className="text-[11px] uppercase tracking-wide text-foreground/55">Step {idx + 1}</div>
                  <div className="mt-0.5 font-medium">{lifecycleLabel[step]}</div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {isRenter ? (
        <BookingActions
          bookingId={booking.id}
          currentEndDateISO={booking.endDate.toISOString()}
          startDateISO={booking.startDate.toISOString()}
          status={booking.status}
          existingReview={existingRenterReview}
        />
      ) : null}

      <BookingChat bookingId={booking.id} viewerId={viewerId} viewerRole={viewerRole} />

      {isAdmin || isRenter ? (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/bookings/${encodeURIComponent(booking.id)}/receipt`}
            className="btn-link-secondary"
          >
            Download receipt (PDF)
          </a>
        </div>
      ) : null}

      {isManualPayment ? (
        <Card>
          <CardHeader>
            <CardTitle>Instant EFT payment</CardTitle>
            <CardDescription>Use the reference below so we can match your payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-foreground/60">Payment Reference</div>
                <div className="font-mono text-xl font-bold tracking-wider text-green-600 dark:text-green-400">
                  {booking.paymentReference || `RS-${booking.id}`}
                </div>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70 mb-2">Price Breakdown</div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground/60">
                      {booking.listing.title} × {booking.days} {booking.days === 1 ? "day" : "days"}
                    </span>
                    <span className="font-mono text-xs">
                      {((booking.listing.dailyRateCents * booking.days) / 100).toFixed(0)} {booking.currency}
                    </span>
                  </div>
                  {chauffeurKm > 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-foreground/60">
                        Chauffeur service ({chauffeurKm} km @ R{(chauffeurRateCentsPerKm / 100).toFixed(0)}/km)
                      </span>
                      <span className="font-mono text-xs">
                        {(chauffeurCents / 100).toFixed(0)} {booking.currency}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-2 mt-2">
                    <span className="font-semibold text-foreground">Total Amount Due</span>
                    <span className="font-bold text-lg">
                      R{(booking.totalCents / 100).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-sm font-medium">Bank details</div>
              {hasEftDetails ? (
                <div className="mt-2 grid gap-2 text-sm text-foreground/70">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground/60">Bank</span>
                    <span>{eft.bankName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground/60">Account name</span>
                    <span>{eft.accountName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground/60">Account number</span>
                    <span>{eft.accountNumber}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground/60">Branch code</span>
                    <span>{eft.branchCode}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-foreground/60">
                  Bank details are currently unavailable. Please contact support to complete payment.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex gap-2">
                <span className="text-amber-600 dark:text-amber-400 font-bold">⚠</span>
                <div className="text-xs text-foreground/80">
                  <strong>Important:</strong> Please include the payment reference <span className="font-mono font-bold">{booking.paymentReference || `RS-${booking.id}`}</span> in your bank transfer description so we can match your payment quickly.
                </div>
              </div>
            </div>

            <div className="text-xs text-foreground/60">
              After payment, an admin will confirm your booking. Keep your proof of payment in case support requests it.
            </div>

            {isAdmin || isRenter ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Upload proof of payment</div>
                <div className="text-xs text-foreground/60">Upload a screenshot/photo or a PDF. This is private (renter + admin).</div>

                {paymentProofParam === "uploaded" ? (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-xs text-foreground/80">
                    Proof uploaded. Final step: submit this booking for admin approval.
                  </div>
                ) : null}
                {paymentProofParam === "submitted" ? (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-xs text-foreground/80">
                    Booking submitted for admin approval. You will see status updates on this page.
                  </div>
                ) : null}

                {isRenter ? (
                  <form
                    action={`/api/bookings/${encodeURIComponent(booking.id)}/payment-proof`}
                    method="post"
                    encType="multipart/form-data"
                    className="space-y-2"
                  >
                    <FileDropInput
                      name="proof"
                      label="Proof file"
                      accept="image/*,application/pdf"
                      required
                      helper="Images or PDF up to 8MB"
                    />
                    <Button type="submit" variant="secondary">
                      Upload proof
                    </Button>
                  </form>
                ) : null}

                {isRenter && hasPaymentProof ? (
                  <form
                    action={`/api/bookings/${encodeURIComponent(booking.id)}/payment-proof/submit`}
                    method="post"
                    className="rounded-xl border border-accent/30 bg-accent-soft p-3"
                  >
                    <div className="text-sm font-medium">Finish booking submission</div>
                    <div className="mt-1 text-xs text-foreground/70">
                      This moves your booking to waiting-for-approval and notifies admin to verify payment proof.
                    </div>
                    <div className="mt-3">
                      <Button type="submit">Submit for approval</Button>
                    </div>
                  </form>
                ) : null}

                {!paymentProofRes ? null : !paymentProofRes.ok ? (
                  <div className="text-sm text-foreground/60">Could not load proofs: {paymentProofRes.error}</div>
                ) : paymentProofRes.proofs.length === 0 ? (
                  <div className="text-sm text-foreground/60">No proof uploaded yet.</div>
                ) : (
                  <div className="grid gap-2">
                    {paymentProofRes.proofs.slice(0, 3).map((p) => (
                      <a
                        key={p.name}
                        href={p.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-border bg-card p-3 text-sm"
                      >
                        Open proof (signed URL)
                      </a>
                    ))}
                    {paymentProofRes.proofs.length > 3 ? (
                      <div className="text-xs text-foreground/60">Showing latest 3 proofs.</div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Photo log</CardTitle>
          <CardDescription>
            Handover and return photos help prevent disputes. Photos are private and shared only with the renter, host, and admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {PHOTO_KINDS.map(({ kind, label, helper }) => {
            const entry = photosByKind.find((p) => p.kind === kind);
            const res = entry?.result;

            const canUpload =
              isAdmin ||
              ((kind === "host_handover" || kind === "host_return") ? isHost : false) ||
              ((kind === "renter_pickup" || kind === "renter_return") ? isRenter : false);

            return (
              <div key={kind} className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-foreground/60">{helper}</div>
                  </div>
                  {canUpload ? (
                    <form
                      action={`/api/bookings/${encodeURIComponent(booking.id)}/photos`}
                      method="post"
                      encType="multipart/form-data"
                      className="w-full max-w-sm space-y-2"
                    >
                      <input type="hidden" name="kind" value={kind} />
                      <FileDropInput
                        name="photo"
                        label="Upload photo"
                        helper="JPG/PNG up to 8MB"
                        accept="image/*"
                        required
                      />
                      <Button type="submit" variant="secondary">
                        Upload
                      </Button>
                    </form>
                  ) : null}
                </div>

                {!res ? null : !res.ok ? (
                  <div className="text-sm text-foreground/60">Could not load photos: {res.error}</div>
                ) : res.photos.length === 0 ? (
                  <div className="text-sm text-foreground/60">No photos uploaded yet.</div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {res.photos.map((p) => (
                      <a
                        key={p.name}
                        href={p.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-xl border border-border bg-card"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.signedUrl}
                          alt={`${label} photo`}
                          className="h-44 w-full object-cover transition-transform group-hover:scale-[1.01]"
                          loading="lazy"
                        />
                        <div className="border-t border-border p-2 text-xs text-foreground/60">
                          Open (signed URL)
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
          <CardDescription>What to do before pickup and during your booking.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
            <li>Double-check your dates and booking details.</li>
            <li>Bring a valid driver’s license and ID.</li>
            <li>Need help during the booking? Create a support ticket.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/renter#support">
              <Button variant="secondary">Contact support</Button>
            </Link>
            <Link href="/cancellation">
              <Button variant="secondary">Cancellation policy</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href={`/listings/${booking.listing.id}`}>
          <Button variant="secondary">Back to listing</Button>
        </Link>
        <Link href="/listings">
          <Button>Browse more</Button>
        </Link>
        {isAdmin || isRenter ? (
          <a
            className="btn-link-secondary"
            href={`/api/bookings/${encodeURIComponent(booking.id)}/receipt`}
          >
            Download receipt (PDF)
          </a>
        ) : null}
        {isPending ? (
          <Link href={`/checkout/${booking.listing.id}?start=${encodeURIComponent(booking.startDate.toISOString().slice(0, 10))}&end=${encodeURIComponent(booking.endDate.toISOString().slice(0, 10))}${chauffeurKm > 0 ? `&chauffeurKm=${encodeURIComponent(String(chauffeurKm))}&chauffeur=1` : ""}`}>
            <Button variant="secondary">Try payment again</Button>
          </Link>
        ) : null}
      </div>
    </main>
  );
}
