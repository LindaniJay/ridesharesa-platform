import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { badgeVariantForBookingStatus } from "@/app/lib/badgeVariants";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/require";
import BookingStatusClient from "@/app/bookings/[id]/BookingStatusClient";

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
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { dbUser } = await requireUser();
  const viewerRole = dbUser.role;
  const viewerId = dbUser.id;

  const chauffeurKmRaw = Array.isArray(searchParams?.chauffeurKm)
    ? searchParams?.chauffeurKm[0]
    : searchParams?.chauffeurKm;
  const chauffeurKmParsed = parseIntParam(chauffeurKmRaw);
  const chauffeurKm = chauffeurKmParsed && chauffeurKmParsed > 0 ? Math.min(chauffeurKmParsed, 5000) : 0;
  const chauffeurRateCentsPerKm = 10 * 100;
  const chauffeurCents = chauffeurKm > 0 ? chauffeurKm * chauffeurRateCentsPerKm : 0;

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
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
          dailyRateCents: true,
        },
      },
    },
  });

  if (!booking) notFound();
  if (viewerRole !== "ADMIN" && booking.renterId !== viewerId) redirect("/listings");

  const isPending = booking.status === "PENDING_PAYMENT";
  const isManualPayment = isPending && !booking.stripeCheckoutSessionId;

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
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{booking.listing.title}</CardTitle>
          <CardDescription>{booking.listing.city}</CardDescription>
        </CardHeader>
        <CardContent>
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
