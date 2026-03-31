import Link from "next/link";
import Image from "next/image";

import ListingMap from "@/app/components/ListingMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { RESERVED_BOOKING_STATUSES } from "@/app/lib/bookings";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

type ListingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ListingsSearchParams = {
  q?: string;
  start?: string;
  end?: string;
  sort?: "recent" | "price_asc" | "price_desc" | string;
};

function first(param: string | string[] | undefined) {
  if (!param) return "";
  return Array.isArray(param) ? String(param[0] ?? "") : String(param);
}

export default async function ListingsPage({
  searchParams,
}: ListingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  const q = first(resolvedSearchParams?.q).trim();
  const start = first(resolvedSearchParams?.start).trim();
  const end = first(resolvedSearchParams?.end).trim();
  const sort = (first(resolvedSearchParams?.sort).trim() || "recent") as ListingsSearchParams["sort"];
  const minPrice = Number(first(resolvedSearchParams?.minPrice)) || 0;
  const maxPrice = Number(first(resolvedSearchParams?.maxPrice)) || 0;
  const instantBooking = first(resolvedSearchParams?.instantBooking) === "on";
  const carType = first(resolvedSearchParams?.carType).trim();

  const orderBy =
    sort === "price_asc"
      ? ({ dailyRateCents: "asc" } as const)
      : sort === "price_desc"
        ? ({ dailyRateCents: "desc" } as const)
        : ({ createdAt: "desc" } as const);

    const now = new Date();

    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    const hasValidDates =
      Boolean(startDate && endDate) &&
      !Number.isNaN(startDate!.getTime()) &&
      !Number.isNaN(endDate!.getTime()) &&
      endDate!.getTime() > startDate!.getTime();

  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      isApproved: true,
      bookings: {
        none: hasValidDates
          ? {
              status: { in: RESERVED_BOOKING_STATUSES },
              startDate: { lt: endDate! },
              endDate: { gt: startDate! },
            }
          : {
              status: { in: RESERVED_BOOKING_STATUSES },
              startDate: { lte: now },
              endDate: { gte: now },
            },
      },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { country: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(minPrice > 0 ? { dailyRateCents: { gte: Math.round(minPrice * 100) } } : {}),
      ...(maxPrice > 0 ? { dailyRateCents: { lte: Math.round(maxPrice * 100) } } : {}),
      ...(instantBooking ? { instantBooking: true } : {}),
      ...(carType ? { title: { contains: carType, mode: "insensitive" } } : {}),
    },
    orderBy,
    take: 50,
    select: {
      id: true,
      title: true,
      city: true,
      country: true,
      latitude: true,
      longitude: true,
      dailyRateCents: true,
      currency: true,
      imageUrl: true,
      instantBooking: true,
    },
  });

  const averageDailyRate = listings.length
    ? Math.round(listings.reduce((sum, listing) => sum + listing.dailyRateCents, 0) / listings.length / 100)
    : 0;
  const instantBookingCount = listings.filter((listing) => listing.instantBooking).length;

  const cityCounts = new Map<string, { count: number }>();
  for (const listing of listings) {
    const key = listing.city.trim();
    const current = cityCounts.get(key);
    cityCounts.set(key, {
      count: (current?.count ?? 0) + 1,
    });
  }

  const featuredCities = [...cityCounts.entries()]
    .map(([city, value]) => ({ city, count: value.count }))
    .sort((left, right) => right.count - left.count || left.city.localeCompare(right.city))
    .slice(0, 4);

  function buildListingsHref(overrides: {
    q?: string | null;
    instantBooking?: boolean | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    carType?: string | null;
  }) {
    const next = new URLSearchParams();

    const nextQ = overrides.q === undefined ? q : overrides.q ?? "";
    const nextInstantBooking = overrides.instantBooking === undefined ? instantBooking : Boolean(overrides.instantBooking);
    const nextMinPrice = overrides.minPrice === undefined ? minPrice : overrides.minPrice ?? 0;
    const nextMaxPrice = overrides.maxPrice === undefined ? maxPrice : overrides.maxPrice ?? 0;
    const nextCarType = overrides.carType === undefined ? carType : overrides.carType ?? "";

    if (nextQ) next.set("q", nextQ);
    if (start) next.set("start", start);
    if (end) next.set("end", end);
    if (sort && sort !== "recent") next.set("sort", sort);
    if (nextMinPrice) next.set("minPrice", String(nextMinPrice));
    if (nextMaxPrice) next.set("maxPrice", String(nextMaxPrice));
    if (nextCarType) next.set("carType", nextCarType);
    if (nextInstantBooking) next.set("instantBooking", "on");

    const query = next.toString();
    return query ? `/listings?${query}` : "/listings";
  }

  const carry = new URLSearchParams();
  if (start) carry.set("start", start);
  if (end) carry.set("end", end);
  const carryQS = carry.toString();

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
        <p className="text-sm text-foreground/60">Browse approved cars near you.</p>
      </div>

      <Card className="relative overflow-hidden border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-44 w-44 rounded-full bg-accent/16 blur-3xl" />
          <div className="absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-foreground/8 blur-3xl" />
        </div>
        <CardContent className="relative space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Discover faster</div>
              <div className="max-w-2xl text-xl font-semibold tracking-tight sm:text-2xl">
                Shortlist the right car before you even open a card.
              </div>
              <div className="max-w-2xl text-sm text-foreground/65">
                Use quick city jumps, instant-booking shortcuts, and live availability to get to the right option faster.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background/55 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-foreground/55">Available now</div>
                <div className="mt-1 text-lg font-semibold">{listings.length}</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/55 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-foreground/55">Instant book</div>
                <div className="mt-1 text-lg font-semibold">{instantBookingCount}</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/55 px-4 py-3 col-span-2 sm:col-span-1">
                <div className="text-xs uppercase tracking-wide text-foreground/55">Avg daily rate</div>
                <div className="mt-1 text-lg font-semibold">{averageDailyRate} ZAR</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link className="btn-link-secondary h-9 px-3 text-xs" href={buildListingsHref({ instantBooking: true })}>
              Instant booking only
            </Link>
            {(q || instantBooking) ? (
              <Link className="btn-link-secondary h-9 px-3 text-xs" href="/listings">
                Reset filters
              </Link>
            ) : null}
            <div className="text-xs text-foreground/55">Quick cities:</div>
            {featuredCities.map((city) => (
              <Link
                key={city.city}
                href={buildListingsHref({ q: city.city })}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground/75 transition-colors hover:bg-muted"
              >
                <span>{city.city}</span>
                <span className="text-foreground/45">{city.count}</span>
              </Link>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Featured collections</div>
            <div className="flex flex-wrap items-center gap-2">
              <Link className="btn-link-secondary h-9 px-3 text-xs" href={buildListingsHref({ maxPrice: 700, minPrice: null })}>
                Budget picks
              </Link>
              <Link className="btn-link-secondary h-9 px-3 text-xs" href={buildListingsHref({ carType: "SUV" })}>
                Family SUVs
              </Link>
              <Link className="btn-link-secondary h-9 px-3 text-xs" href={buildListingsHref({ minPrice: 1200, maxPrice: null })}>
                Premium rides
              </Link>
              <Link className="btn-link-secondary h-9 px-3 text-xs" href={buildListingsHref({ carType: "sedan", instantBooking: true })}>
                Fast business trips
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="search-panel">
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Use a city name to narrow results.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-3 sm:grid-cols-6">
            <label className="block sm:col-span-3">
              <div className="mb-1 text-sm">City / keyword</div>
              <Input name="q" defaultValue={q} placeholder="e.g. Cape Town" />
            </label>
            <label className="block sm:col-span-1">
              <div className="mb-1 text-sm">Start</div>
              <Input name="start" type="date" defaultValue={start} />
            </label>
            <label className="block sm:col-span-1">
              <div className="mb-1 text-sm">End</div>
              <Input name="end" type="date" defaultValue={end} />
            </label>
            <label className="block sm:col-span-1">
              <div className="mb-1 text-sm">Sort</div>
              <select
                name="sort"
                defaultValue={sort}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                <option value="recent">Most recent</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
            <label className="block sm:col-span-1">
              <div className="mb-1 text-sm">Min price (ZAR)</div>
              <Input name="minPrice" type="number" min="0" defaultValue={minPrice || ""} placeholder="0" />
            </label>
            <label className="block sm:col-span-1">
              <div className="mb-1 text-sm">Max price (ZAR)</div>
              <Input name="maxPrice" type="number" min="0" defaultValue={maxPrice || ""} placeholder="0" />
            </label>
            <label className="block sm:col-span-1">
              <div className="mb-1 text-sm">Car type</div>
              <Input name="carType" defaultValue={carType} placeholder="e.g. SUV, sedan" />
            </label>
            <label className="flex items-center gap-2 sm:col-span-1">
              <input type="checkbox" name="instantBooking" defaultChecked={instantBooking} className="accent-accent" />
              <span className="text-sm">Instant booking</span>
            </label>
            <div className="sm:col-span-6 flex flex-wrap items-center gap-2">
              <Button type="submit">Update results</Button>
              {(q || start || end || (sort && sort !== "recent") || minPrice || maxPrice || instantBooking || carType) && (
                <Link className="text-sm underline" href="/listings">
                  Clear
                </Link>
              )}
              <div className="text-sm text-foreground/60">{listings.length} result(s)</div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div id="map-panel">
        <ListingMap listings={listings} />
      </div>

      {listings.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No results</CardTitle>
            <CardDescription>
              {q ? (
                <span>
                  No approved listings matched <span className="font-medium">“{q}”</span>.
                </span>
              ) : (
                "Approved listings will show here once available."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              Try clearing your search, or browse all listings. If you&apos;re a host, create a listing in{" "}
              <Link className="underline" href="/host">
                Host
              </Link>{" "}
              and ask an admin to approve it.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Link
              key={l.id}
              href={carryQS ? `/listings/${l.id}?${carryQS}` : `/listings/${l.id}`}
              className="group"
            >
              <div className="rounded-xl border border-border bg-background p-4 shadow-sm shadow-black/5 transition-colors group-hover:bg-muted/50">
                {l.imageUrl ? (
                  <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-lg border border-border">
                    <Image
                      src={l.imageUrl}
                      alt={l.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover"
                      priority={false}
                    />
                  </div>
                ) : null}
                <div className="text-base font-semibold tracking-tight">{l.title}</div>
                <div className="mt-1 text-sm text-foreground/60">
                  {l.city}, {l.country}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-foreground/70">
                  <span className="rounded-full border border-border bg-background/70 px-2 py-0.5">Approved listing</span>
                  <span className="rounded-full border border-border bg-background/70 px-2 py-0.5">Secure checkout</span>
                  {l.instantBooking ? (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">Instant book</span>
                  ) : (
                    <span className="rounded-full border border-border bg-background/70 px-2 py-0.5">Host approval</span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm">
                    {(l.dailyRateCents / 100).toFixed(0)} {l.currency}
                    <span className="text-foreground/50"> / day</span>
                  </div>
                  <div className="text-sm font-medium underline">View</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 px-3 sm:hidden">
        <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-2 rounded-2xl border border-border bg-background/92 px-3 py-2 shadow-[0_10px_25px_-15px_rgba(0,0,0,0.55)] backdrop-blur">
          <a href="#search-panel" className="btn-link-secondary h-8 px-3 text-xs">Filters</a>
          <a href="#map-panel" className="btn-link-secondary h-8 px-3 text-xs">Map</a>
          <div className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground/70">
            {listings.length} results
          </div>
        </div>
      </div>
    </main>
  );
}
