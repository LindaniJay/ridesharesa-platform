import { redirect } from "next/navigation";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";
import CheckoutClient from "@/app/checkout/[listingId]/CheckoutClient";

function first(param: string | string[] | undefined) {
  if (!param) return "";
  return Array.isArray(param) ? String(param[0] ?? "") : String(param);
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: { listingId: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("RENTER");

  const resolvedSearchParams = (await searchParams) ?? {};

  const initialStartDate = first(resolvedSearchParams?.start).trim();
  const initialEndDate = first(resolvedSearchParams?.end).trim();

  const listing = await prisma.listing.findFirst({
    where: { id: params.listingId, status: "ACTIVE", isApproved: true },
    select: {
      id: true,
      title: true,
      city: true,
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
          />
        </CardContent>
      </Card>
    </main>
  );
}
