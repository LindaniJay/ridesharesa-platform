import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { badgeVariantForBookingStatus } from "@/app/lib/badgeVariants";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import BookingStatusClient from "@/app/bookings/[id]/BookingStatusClient";

type BookingPhotoKind = "host_handover" | "renter_pickup" | "renter_return" | "host_return";

type PaymentProofKind = "payment_proof";

const PHOTO_KINDS: Array<{ kind: BookingPhotoKind; label: string; helper: string }> = [
  { kind: "host_handover", label: "Host handover", helper: "Host uploads proof before pickup." },
  { kind: "renter_pickup", label: "Renter pickup", helper: "Renter uploads proof at pickup." },
  { kind: "renter_return", label: "Renter return", helper: "Renter uploads proof at return." },
  { kind: "host_return", label: "Host return inspection", helper: "Host uploads inspection after return." },
];

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
  const chauffeurKmParsed = parseIntParam(chauffeurKmRaw);
  const chauffeurKm = chauffeurKmParsed && chauffeurKmParsed > 0 ? Math.min(chauffeurKmParsed, 5000) : 0;
  const chauffeurRateCentsPerKm = 10 * 100;
  const chauffeurCents = chauffeurKm > 0 ? chauffeurKm * chauffeurRateCentsPerKm : 0;

  const booking = await prisma.booking.findUnique({
    where: { id: resolvedParams.id },
    select: {
      id: true,
      status: true,
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

  const photosByKind = await Promise.all(
    PHOTO_KINDS.map(async ({ kind }) => ({
      kind,
      result: await listSignedBookingPhotos({ bookingId: booking.id, kind }),
    })),
  );

  const isPending = booking.status === "PENDING_PAYMENT";
  const isManualPayment = isPending && !booking.stripeCheckoutSessionId;

  const paymentProofRes = isManualPayment && (isAdmin || isRenter)
    ? await listSignedPaymentProofs({ bookingId: booking.id, kind: "payment_proof" })
    : null;

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

  return (
    <main className="mx-auto max-w-xl space-y-4">
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

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isPending ? "Booking pending" : "Booking confirmed"}
        </h1>
        <p className="text-sm text-foreground/60">
          {isPending
            ? isManualPayment
              ? "Complete payment via Instant EFT to confirm this booking."
              : "Payment is processing. This page will update after Stripe confirms payment."
            : "Your reservation is confirmed."}
        </p>
      </div>

      <BookingStatusClient pending={isPending} method={isManualPayment ? "manual" : "stripe"} />

      {isManualPayment ? (
        <Card>
          <CardHeader>
            <CardTitle>Instant EFT payment</CardTitle>
            <CardDescription>Use the reference below so we can match your payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-foreground/60">Reference</div>
                <div className="font-mono text-xs">RS-{booking.id}</div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-foreground/60">Amount</div>
                <div className="font-medium">
                  {(booking.totalCents / 100).toFixed(0)} {booking.currency}
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

            <div className="text-xs text-foreground/60">
              After payment, an admin will confirm your booking. Keep your proof of payment in case support requests it.
            </div>

            {isAdmin || isRenter ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Upload proof of payment</div>
                <div className="text-xs text-foreground/60">Upload a screenshot/photo or a PDF. This is private (renter + admin).</div>

                {isRenter ? (
                  <form
                    action={`/api/bookings/${encodeURIComponent(booking.id)}/payment-proof`}
                    method="post"
                    encType="multipart/form-data"
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      name="proof"
                      type="file"
                      accept="image/*,application/pdf"
                      required
                      className="max-w-[260px] text-sm"
                    />
                    <Button type="submit" variant="secondary">
                      Upload proof
                    </Button>
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
          <CardTitle>{booking.listing.title}</CardTitle>
          <CardDescription>{booking.listing.city}</CardDescription>
        </CardHeader>
        <CardContent>
          {booking.listing.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={booking.listing.imageUrl}
                alt={booking.listing.title}
                className="mb-3 h-40 w-full rounded-xl border border-border object-cover"
                loading="lazy"
              />
            </>
          ) : null}
          <div className="mb-3">
            <Badge variant={badgeVariantForBookingStatus(booking.status)}>{booking.status}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-black/60 dark:text-white/60">Start</div>
              <div>{booking.startDate.toISOString().slice(0, 10)}</div>
            </div>
            <div>
              <div className="text-black/60 dark:text-white/60">End</div>
              <div>{booking.endDate.toISOString().slice(0, 10)}</div>
            </div>
            <div>
              <div className="text-black/60 dark:text-white/60">Days</div>
              <div>{booking.days}</div>
            </div>
            <div>
              <div className="text-black/60 dark:text-white/60">Daily rate</div>
              <div>
                {(booking.listing.dailyRateCents / 100).toFixed(0)} {booking.currency}
              </div>
            </div>

            {chauffeurKm > 0 ? (
              <>
                <div>
                  <div className="text-black/60 dark:text-white/60">Rental total</div>
                  <div>
                    {(rentalCents / 100).toFixed(0)} {booking.currency}
                  </div>
                </div>
                <div>
                  <div className="text-black/60 dark:text-white/60">Chauffeur</div>
                  <div>
                    {chauffeurKm} km × 10 = {(chauffeurCents / 100).toFixed(0)} {booking.currency}
                  </div>
                </div>
              </>
            ) : null}

            <div>
              <div className="text-black/60 dark:text-white/60">Total</div>
              <div>
                {(booking.totalCents / 100).toFixed(0)} {booking.currency}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="kind" value={kind} />
                      <input
                        name="photo"
                        type="file"
                        accept="image/*"
                        required
                        className="max-w-[220px] text-sm"
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
        {isPending ? (
          <Link href={`/checkout/${booking.listing.id}?start=${encodeURIComponent(booking.startDate.toISOString().slice(0, 10))}&end=${encodeURIComponent(booking.endDate.toISOString().slice(0, 10))}${chauffeurKm > 0 ? `&chauffeurKm=${encodeURIComponent(String(chauffeurKm))}&chauffeur=1` : ""}`}>
            <Button variant="secondary">Try payment again</Button>
          </Link>
        ) : null}
      </div>
    </main>
  );
}
