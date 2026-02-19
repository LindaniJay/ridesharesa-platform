import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";

import ListingMap from "@/app/components/ListingMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import { prisma } from "@/app/lib/prisma";

type ListingPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(param: string | string[] | undefined) {
  if (!param) return "";
  return Array.isArray(param) ? String(param[0] ?? "") : String(param);
}

export default async function ListingDetailsPage({
  params,
  searchParams,
}: ListingPageProps) {
  const { id } = await params;

  const resolvedSearchParams = (await searchParams) ?? {};
  const start = first(resolvedSearchParams?.start).trim();
  const end = first(resolvedSearchParams?.end).trim();

  const carry = new URLSearchParams();
  if (start) carry.set("start", start);
  if (end) carry.set("end", end);
  const carryQS = carry.toString();

  const now = new Date();

  const [listing, upcomingBookings] = await Promise.all([
    prisma.listing.findFirst({
      where: { id, status: "ACTIVE", isApproved: true },
      select: {
        id: true,
        title: true,
        description: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        dailyRateCents: true,
        currency: true,
        imageUrl: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        listingId: id,
        status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
        endDate: { gte: now },
      },
      orderBy: { startDate: "asc" },
      take: 8,
      select: { startDate: true, endDate: true, status: true },
    }),
  ]);

  if (!listing) notFound();

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
        <div className="text-sm text-black/60 dark:text-white/60">
          {listing.city}, {listing.country}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {listing.imageUrl ? (
            <Card>
              <CardHeader>
                <CardTitle>Photo</CardTitle>
                <CardDescription>Listing image</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
                  <Image
                    src={listing.imageUrl}
                    alt={listing.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority={false}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Book</CardTitle>
              <CardDescription>Select dates to continue to checkout.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={`/checkout/${listing.id}`}
                method="GET"
                className="grid gap-3 sm:grid-cols-2"
              >
                <label className="block">
                  <div className="mb-1 text-sm">Start date</div>
                  <Input name="start" type="date" defaultValue={start} required />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">End date</div>
                  <Input name="end" type="date" defaultValue={end} required />
                  <div className="mt-1 text-xs text-black/50 dark:text-white/50">End date must be after start date.</div>
                </label>

                <div className="sm:col-span-2 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-black/60 dark:text-white/60">Daily rate</span>
                    <span>
                      {(listing.dailyRateCents / 100).toFixed(0)} {listing.currency}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-black/50 dark:text-white/50">
                    Final amount is confirmed on Stripe at checkout.
                  </div>
                </div>

                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <Button type="submit" className="w-full sm:w-auto">
                    Continue to checkout
                  </Button>
                  <Link className="text-sm underline" href={carryQS ? `/listings?${carryQS}` : "/listings"}>
                    Back to results
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>Listing details and renter notes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{listing.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
              <CardDescription>Upcoming reservations on this car.</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingBookings.length === 0 ? (
                <div className="text-sm text-black/60 dark:text-white/60">No upcoming reservations are visible right now.</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {upcomingBookings.map((b, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10">
                      <div>
                        <div className="font-medium">
                          {b.startDate.toISOString().slice(0, 10)} → {b.endDate.toISOString().slice(0, 10)}
                        </div>
                        <div className="text-xs text-black/50 dark:text-white/50">Status: {b.status}</div>
                      </div>
                      <div className="text-xs text-black/50 dark:text-white/50">Not available</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 text-xs text-black/50 dark:text-white/50">
                Availability is shown from recent bookings. Final confirmation happens during checkout.
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <ListingMap listings={[listing]} />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-background/95 p-3 backdrop-blur dark:border-white/10 sm:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium">{(listing.dailyRateCents / 100).toFixed(0)} {listing.currency} / day</div>
            <div className="text-xs text-black/50 dark:text-white/50">Select dates to book</div>
          </div>
          <div className="pointer-events-auto">
            <Link href={carryQS ? `/checkout/${listing.id}?${carryQS}` : `/checkout/${listing.id}`}>
              <Button>Book</Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
