import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";

import ListingMap from "@/app/components/ListingMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import { RESERVED_BOOKING_STATUSES } from "@/app/lib/bookings";
import { prisma } from "@/app/lib/prisma";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

type ListingPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(param: string | string[] | undefined) {
  if (!param) return "";
  return Array.isArray(param) ? String(param[0] ?? "") : String(param);
}

async function listListingGalleryUrls(listingId: string) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "listing-images";
  const admin = supabaseAdmin();

  const { data, error } = await admin.storage.from(bucket).list(listingId, {
    limit: 50,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) return [] as string[];

  const urls: string[] = [];
  for (const o of data ?? []) {
    if (!o.name) continue;
    const path = `${listingId}/${o.name}`;
    const { data: publicData } = admin.storage.from(bucket).getPublicUrl(path);
    if (publicData?.publicUrl) urls.push(publicData.publicUrl);
  }
  return urls;
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

  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const hasValidDates =
    Boolean(startDate && endDate) &&
    !Number.isNaN(startDate!.getTime()) &&
    !Number.isNaN(endDate!.getTime()) &&
    endDate!.getTime() > startDate!.getTime();

  const [listing, upcomingBookings, conflictForSelectedDates] = await Promise.all([
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
        isDemo: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        listingId: id,
        status: { in: RESERVED_BOOKING_STATUSES },
        endDate: { gte: now },
      },
      orderBy: { startDate: "asc" },
      take: 8,
      select: { startDate: true, endDate: true, status: true },
    }),
    hasValidDates
      ? prisma.booking.findFirst({
          where: {
            listingId: id,
            status: { in: RESERVED_BOOKING_STATUSES },
            startDate: { lt: endDate! },
            endDate: { gt: startDate! },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!listing) notFound();

  const galleryFromStorage = await listListingGalleryUrls(listing.id);
  const gallery = Array.from(
    new Set([listing.imageUrl || null, ...galleryFromStorage].filter((u): u is string => Boolean(u))),
  );
  const heroUrl = gallery[0] || null;

  const isUnavailableForSelectedDates = Boolean(conflictForSelectedDates);

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
          {listing.isDemo ? <span className="rounded-full bg-amber-400/90 px-2.5 py-1 text-xs font-semibold text-slate-900">Demo</span> : null}
        </div>
        <div className="text-sm text-foreground/60">
          {listing.city}, {listing.country}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {/* Trust badges and safety info */}
          <Card>
            <CardHeader>
              <CardTitle>Trust & Safety</CardTitle>
              <CardDescription>Verified hosts, secure payments, and insurance protection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-block rounded-full border border-accent/35 bg-accent/12 px-2 py-1 text-xs font-medium text-accent">Verified host</span>
                <span className="inline-block rounded-full border border-accent/35 bg-accent/12 px-2 py-1 text-xs font-medium text-accent">Insurance included</span>
                <span className="inline-block rounded-full border border-accent/35 bg-accent/12 px-2 py-1 text-xs font-medium text-accent">Secure payments</span>
              </div>
              <ul className="list-disc pl-5 mt-2">
                <li>Host identity and vehicle documents verified</li>
                <li>Basic liability insurance included for every trip</li>
                <li>Secure payment processing</li>
                <li>24/7 support and roadside assistance</li>
              </ul>
            </CardContent>
          </Card>
          {heroUrl ? (
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
                <CardDescription>Vehicle gallery</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border">
                  <Image
                    src={heroUrl}
                    alt={listing.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority={false}
                  />
                </div>

                {gallery.length > 1 ? (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {gallery.slice(0, 8).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative aspect-[4/3] overflow-hidden rounded-md border border-border"
                      >
                        <Image
                          src={url}
                          alt="Gallery photo"
                          fill
                          sizes="(max-width: 640px) 33vw, 12vw"
                          className="object-cover"
                          priority={false}
                        />
                      </a>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Book</CardTitle>
              <CardDescription>Select dates to continue to checkout.</CardDescription>
            </CardHeader>
            <CardContent>
              {isUnavailableForSelectedDates ? (
                <div className="mb-3 rounded-xl border border-border bg-card p-3 text-sm text-foreground/70">
                  This vehicle is not available for the selected dates. Please choose different dates.
                </div>
              ) : null}
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
                  <Button type="submit" className="w-full sm:w-auto" disabled={isUnavailableForSelectedDates}>
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
            {isUnavailableForSelectedDates ? (
              <Button disabled>Not available</Button>
            ) : (
              <Link href={carryQS ? `/checkout/${listing.id}?${carryQS}` : `/checkout/${listing.id}`}>
                <Button>Book</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
