import Link from "next/link";
import Image from "next/image";
import ListingMap from "@/app/components/ListingMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { fetchListingsWithFallback, Listing, formatRate } from "@/app/lib/listings";

export const dynamic = "force-dynamic";

type ListingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(param: string | string[] | undefined) {
  if (!param) return "";
  return Array.isArray(param) ? String(param[0] ?? "") : String(param);
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const q = first(resolvedSearchParams?.q).trim();
  const start = first(resolvedSearchParams?.start).trim();
  const end = first(resolvedSearchParams?.end).trim();
  const sort = (first(resolvedSearchParams?.sort).trim() || "recent") as "recent" | "price_asc" | "price_desc";
  const minPrice = Number(first(resolvedSearchParams?.minPrice)) || 0;
  const maxPrice = Number(first(resolvedSearchParams?.maxPrice)) || 0;
  const instantBooking = first(resolvedSearchParams?.instantBooking) === "on";
  const carType = first(resolvedSearchParams?.carType).trim();
  const hasFilters = Boolean(q || start || end || (sort && sort !== "recent") || minPrice || maxPrice || instantBooking || carType);

  let listings: Listing[] = [];
  let fetchError: string | null = null;
  try {
    listings = await fetchListingsWithFallback({
      q,
      minPrice,
      maxPrice,
      instantBooking,
      carType,
      sort,
      take: 50,
    });
  } catch (err) {
    console.error("[listings] fetch failed:", err);
    fetchError = "Unable to load listings right now. Please try again in a moment.";
  }

  const averageDailyRate = listings.length
    ? Math.round(listings.reduce((sum, listing) => sum + listing.dailyRateCents, 0) / listings.length / 100)
    : 0;
  const instantBookingCount = listings.filter((listing) => listing.instantBooking).length;

  const cityCounts = new Map<string, { count: number }>();
  for (const listing of listings) {
    const key = String(listing.city ?? "").trim();
    if (!key) continue;
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
    start?: string | null;
    end?: string | null;
    sort?: string | null;
    instantBooking?: boolean | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    carType?: string | null;
  }) {
    const next = new URLSearchParams();
    const nextQ = overrides.q === undefined ? q : overrides.q ?? "";
    const nextStart = overrides.start === undefined ? start : overrides.start ?? "";
    const nextEnd = overrides.end === undefined ? end : overrides.end ?? "";
    const nextSort = overrides.sort === undefined ? sort : overrides.sort ?? "recent";
    const nextInstantBooking = overrides.instantBooking === undefined ? instantBooking : Boolean(overrides.instantBooking);
    const nextMinPrice = overrides.minPrice === undefined ? minPrice : overrides.minPrice ?? 0;
    const nextMaxPrice = overrides.maxPrice === undefined ? maxPrice : overrides.maxPrice ?? 0;
    const nextCarType = overrides.carType === undefined ? carType : overrides.carType ?? "";
    if (nextQ) next.set("q", nextQ);
    if (nextStart) next.set("start", nextStart);
    if (nextEnd) next.set("end", nextEnd);
    if (nextSort && nextSort !== "recent") next.set("sort", nextSort);
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
  const availabilityLabel = start && end ? "Matches dates" : "Available today";
  const hasCustomSort = typeof sort === "string" && sort !== "recent";
  const activeFilters = [
    q ? { label: `Keyword: ${q}`, href: buildListingsHref({ q: null }) } : null,
    start ? { label: `From ${start}`, href: buildListingsHref({ start: null }) } : null,
    end ? { label: `Until ${end}`, href: buildListingsHref({ end: null }) } : null,
    hasCustomSort ? { label: `Sort: ${sort.replace("_", " ")}`, href: buildListingsHref({ sort: null }) } : null,
    minPrice ? { label: `Min ${minPrice} ZAR`, href: buildListingsHref({ minPrice: null }) } : null,
    maxPrice ? { label: `Max ${maxPrice} ZAR`, href: buildListingsHref({ maxPrice: null }) } : null,
    carType ? { label: `Type: ${carType}`, href: buildListingsHref({ carType: null }) } : null,
    instantBooking ? { label: "Instant booking", href: buildListingsHref({ instantBooking: false }) } : null,
  ].filter((value): value is { label: string; href: string } => Boolean(value));

  if (fetchError) {
    return (
      <main className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
        </div>
        <Card className="relative overflow-hidden border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-16 top-0 h-44 w-44 rounded-full bg-accent/16 blur-3xl" />
            <div className="absolute -right-16 bottom-0 h-44 w-44 rounded-full bg-foreground/8 blur-3xl" />
          </div>
          <CardHeader className="relative">
            <CardTitle>Temporarily unavailable</CardTitle>
            <CardDescription>{fetchError}</CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-wrap items-center gap-3">
            <Link className="btn-link-secondary h-10 px-4 text-sm" href="/listings">
              Reload listings
            </Link>
            <Link className="btn-link-secondary h-10 px-4 text-sm" href="/cities">
              Browse cities
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

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
          <CardDescription>Use filters, dates, and price bands to narrow the right car faster.</CardDescription>
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
              {hasFilters && (
                <Link className="text-sm underline" href="/listings">
                  Clear
                </Link>
              )}
              <div className="text-sm text-foreground/60">{listings.length} result(s)</div>
            </div>
          </form>

          {activeFilters.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Active filters</div>
              {activeFilters.map((filter) => (
                <Link
                  key={filter.label}
                  href={filter.href}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background/55 px-3 py-1.5 text-xs text-foreground/74 transition-colors hover:bg-muted"
                >
                  <span>{filter.label}</span>
                  <span className="text-foreground/45">Clear</span>
                </Link>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div id="map-panel">
        <ListingMap listings={listings} />
      </div>

      <Card className="border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Results overview</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">{listings.length} cars ready to compare</div>
            <div className="mt-1 text-sm text-foreground/62">
              {hasFilters ? "Your filters are shaping a narrower, more intentional shortlist." : "Browse all approved listings and tighten the shortlist with quick filters."}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-foreground/66">
            <span className="rounded-full border border-border bg-background/50 px-3 py-1.5">{availabilityLabel}</span>
            <span className="rounded-full border border-border bg-background/50 px-3 py-1.5">Secure checkout</span>
            <span className="rounded-full border border-border bg-background/50 px-3 py-1.5">Approved listings only</span>
          </div>
        </CardContent>
      </Card>

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
              <div className="relative overflow-hidden rounded-[1.35rem] border border-border bg-background/85 p-4 shadow-sm shadow-black/5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:bg-muted/50">
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-accent/16 blur-3xl" />
                </div>
                {l.imageUrl ? (
                  <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-[1rem] border border-border">
                    <Image
                      src={l.imageUrl}
                      alt={l.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover"
                      priority={false}
                    />
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-slate-950/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">{l.city}</span>
                        {l.isDemo ? <span className="rounded-full bg-amber-400/90 px-2.5 py-1 text-[11px] font-semibold text-slate-900">Demo</span> : null}
                      </div>
                      <span className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-900">{formatRate(l.dailyRateCents, l.currency)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 flex aspect-[16/9] w-full items-end rounded-[1rem] border border-border bg-gradient-to-br from-foreground/10 via-background to-background p-4">
                    <div className="rounded-full border border-border bg-background/75 px-3 py-1 text-xs text-foreground/72">No photo yet</div>
                  </div>
                )}
                <div className="relative text-base font-semibold tracking-tight">{l.title}</div>
                <div className="mt-1 text-sm text-foreground/60">
                  {l.city}, {l.country}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-foreground/70">
                  <span className="rounded-full border border-border bg-background/70 px-2 py-0.5">Approved listing</span>
                  <span className="rounded-full border border-border bg-background/70 px-2 py-0.5">Secure checkout</span>
                  {l.instantBooking ? (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">Instant book</span>
                  ) : (
                    <span className="rounded-full border border-border bg-background/70 px-2 py-0.5">Host approval</span>
                  )}
                  <span className="rounded-full border border-border bg-background/70 px-2 py-0.5">
                    {l.dailyRateCents <= averageDailyRate * 100 || averageDailyRate === 0 ? "Value rate" : "Premium rate"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 rounded-2xl border border-border bg-background/45 p-3 text-xs text-foreground/64">
                  <div className="flex items-center justify-between gap-3">
                    <span>{availabilityLabel}</span>
                    <span>{l.instantBooking ? "Book immediately" : "Host reviews first"}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {formatRate(l.dailyRateCents, l.currency)}
                    <span className="text-foreground/50 font-normal"> / day</span>
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
