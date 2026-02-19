import { redirect } from "next/navigation";
import Link from "next/link";

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

  const listingId = listing.id;
  const dailyRateCents = listing.dailyRateCents;
  const currency = listing.currency;

  return (
    <main className="mx-auto max-w-xl space-y-4">
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

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-sm text-foreground/60">Confirm dates and complete your booking.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{listing.title}</CardTitle>
          <CardDescription>{listing.city}</CardDescription>
        </CardHeader>
        <CardContent>
          {listing.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.imageUrl}
                alt={listing.title}
                className="mb-3 h-40 w-full rounded-xl border border-border object-cover"
                loading="lazy"
              />
            </>
          ) : null}
          <div className="text-sm">
            {(listing.dailyRateCents / 100).toFixed(0)} {listing.currency}
            <span className="text-foreground/50"> / day</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking details</CardTitle>
          <CardDescription>Pick dates, then confirm payment.</CardDescription>
        </CardHeader>
        <CardContent>
          <CheckoutClient
            listingId={listingId}
            dailyRateCents={dailyRateCents}
            currency={currency}
            initialStartDate={initialStartDate}
            initialEndDate={initialEndDate}
            initialChauffeurEnabled={initialChauffeurEnabled}
            initialChauffeurKm={initialChauffeurKm}
          />
        </CardContent>
      </Card>
    </main>
  );
}
