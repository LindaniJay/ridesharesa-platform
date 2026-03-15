import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";
import CheckoutClient from "@/app/checkout/[listingId]/CheckoutClient";

type CheckoutPageProps = {
  params: Promise<{ listingId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(param: string | string[] | undefined) {
  if (!param) return "";
  return Array.isArray(param) ? String(param[0] ?? "") : String(param);
}

function firstInt(param: string | string[] | undefined) {
  const raw = first(param).trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

export default async function CheckoutPage({
  params,
  searchParams,
}: CheckoutPageProps) {
  await requireRole("RENTER");

  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  const initialStartDate = first(resolvedSearchParams?.start).trim();
  const initialEndDate = first(resolvedSearchParams?.end).trim();

  const initialChauffeurKm = firstInt(resolvedSearchParams?.chauffeurKm) ?? 0;
  const initialChauffeurEnabled = first(resolvedSearchParams?.chauffeur).trim() === "1" || initialChauffeurKm > 0;

  const listing = await prisma.listing.findFirst({
    where: { id: resolvedParams.listingId, status: "ACTIVE", isApproved: true },
    select: {
      id: true,
      title: true,
      city: true,
      imageUrl: true,
      dailyRateCents: true,
      currency: true,
    },
  });

  if (!listing) redirect("/listings");

  // If dates are present, enforce availability here too (server-side) so the page
  // doesn't show a checkout form for impossible dates.
  const start = initialStartDate ? new Date(initialStartDate) : null;
  const end = initialEndDate ? new Date(initialEndDate) : null;
  const hasValidDates =
    Boolean(start && end) &&
    !Number.isNaN(start!.getTime()) &&
    !Number.isNaN(end!.getTime()) &&
    end!.getTime() > start!.getTime();

  if (hasValidDates) {
    const reservedStatuses: Array<"PENDING_APPROVAL" | "CONFIRMED"> = ["PENDING_APPROVAL", "CONFIRMED"];
    const conflict = await prisma.booking.findFirst({
      where: {
        listingId: listing.id,
        status: { in: reservedStatuses },
        startDate: { lt: end! },
        endDate: { gt: start! },
      },
      select: { id: true },
    });

    if (conflict) {
      return (
        <main className="mx-auto max-w-xl space-y-4">
          <div className="text-sm text-foreground/60">
            <Link className="underline" href="/listings">
              Listings
            </Link>
            <span className="px-2">/</span>
            <Link className="underline" href={`/listings/${listing.id}`}>
              {listing.title}
            </Link>
            <span className="px-2">/</span>
            <span className="text-foreground">Checkout</span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Not available</CardTitle>
              <CardDescription>This vehicle is not available for the selected dates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                Try different dates or choose another car.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link className="underline" href={`/listings/${listing.id}`}>
                  Back to listing
                </Link>
                <span className="text-foreground/40">•</span>
                <Link className="underline" href="/listings">
                  Browse listings
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      );
    }
  }

  const listingId = listing.id;
  const dailyRateCents = listing.dailyRateCents;
  const currency = listing.currency;

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
    <main className="mx-auto max-w-5xl space-y-4">
      <div className="text-sm text-foreground/60">
        <Link className="underline" href="/listings">
          Listings
        </Link>
        <span className="px-2">/</span>
        <Link className="underline" href={`/listings/${listingId}`}>
          {listing.title}
        </Link>
        <span className="px-2">/</span>
        <span className="text-foreground">Checkout</span>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-5 backdrop-blur supports-[backdrop-filter]:bg-card/40 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute -right-28 -bottom-28 h-72 w-72 rounded-full bg-foreground/8 blur-3xl" />
        </div>

        <div className="relative grid gap-5 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/35 px-3 py-1 text-xs text-foreground/70">
              <span className="inline-flex h-2 w-2 rounded-full bg-accent/80" />
              Secure booking flow
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reserve this car in under 2 minutes</h1>
              <p className="text-sm text-foreground/60">Confirm your trip dates, choose payment method, and get instant booking status updates.</p>
            </div>

            <Card className="overflow-hidden border-border bg-background/35 p-0">
              <CardContent className="mt-0">
                {listing.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={listing.imageUrl}
                      alt={listing.title}
                      className="h-44 w-full border-b border-border object-cover"
                      loading="lazy"
                    />
                  </>
                ) : (
                  <div className="flex h-44 items-center justify-center border-b border-border bg-gradient-to-br from-foreground/8 to-transparent text-sm text-foreground/60">
                    No vehicle photo available
                  </div>
                )}

                <div className="space-y-3 p-4">
                  <div className="space-y-0.5">
                    <CardTitle className="text-lg">{listing.title}</CardTitle>
                    <CardDescription>{listing.city}</CardDescription>
                  </div>
                  <div className="text-sm font-semibold">
                    {(listing.dailyRateCents / 100).toFixed(0)} {listing.currency}
                    <span className="text-foreground/50"> / day</span>
                  </div>
                  <div className="grid gap-2 text-xs text-foreground/65 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-card/70 px-2.5 py-2">Step 1: Dates</div>
                    <div className="rounded-lg border border-border bg-card/70 px-2.5 py-2">Step 2: Price check</div>
                    <div className="rounded-lg border border-border bg-card/70 px-2.5 py-2">Step 3: Payment</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-background/30">
            <CardHeader>
              <CardTitle>Booking details</CardTitle>
              <CardDescription>Pick dates, review total, and complete secure checkout.</CardDescription>
            </CardHeader>
            <CardContent>
              <CheckoutClient
                listingId={listingId}
                dailyRateCents={dailyRateCents}
                currency={currency}
                eftDetails={eft}
                hasEftDetails={hasEftDetails}
                initialStartDate={initialStartDate}
                initialEndDate={initialEndDate}
                initialChauffeurEnabled={initialChauffeurEnabled}
                initialChauffeurKm={initialChauffeurKm}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
