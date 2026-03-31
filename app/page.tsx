import Image from "next/image";
import Link from "next/link";
import { translations } from "@/app/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { RESERVED_BOOKING_STATUSES } from "@/app/lib/bookings";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

function Icon({ name, className }: { name: "car" | "shield" | "bolt" | "sparkles" | "key" | "gear" | "star" | "users"; className?: string }) {
  const common = "h-5 w-5";
  const cls = className ? `${common} ${className}` : common;

  switch (name) {
    case "car":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
          <path
            d="M3.5 13.2V17a2 2 0 0 0 2 2h1.2a1 1 0 0 0 1-1v-.5h8.6v.5a1 1 0 0 0 1 1H20a2 2 0 0 0 2-2v-3.8a3 3 0 0 0-1.7-2.7l-1.6-.8-1.4-3.6A3 3 0 0 0 14.5 4H9.5A3 3 0 0 0 6.7 5.1L5.3 8.7l-1.6.8a3 3 0 0 0-1.2 1.1c-.3.4-.5 1-.5 1.6Z"
            className="stroke-current"
            strokeWidth="1.5"
          />
          <path d="M6.6 8.7h10.8" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M7.2 14.6h.01" className="stroke-current" strokeWidth="3" strokeLinecap="round" />
          <path d="M16.8 14.6h.01" className="stroke-current" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
          <path
            d="M12 2.8 19 6.3v6.4c0 5-3.3 8.8-7 9.9-3.7-1.1-7-4.9-7-9.9V6.3L12 2.8Z"
            className="stroke-current"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M9.3 12l1.8 1.8 3.7-3.7" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "bolt":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
          <path
            d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z"
            className="stroke-current"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
          <path d="M12 2l1.2 4.2L17.4 8 13.2 9.2 12 13.4 10.8 9.2 6.6 8l4.2-1.8L12 2Z" className="fill-current opacity-80" />
          <path d="M19 12l.7 2.4 2.3.6-2.3.6L19 18l-.7-2.4L16 15l2.3-.6L19 12Z" className="fill-current opacity-70" />
          <path d="M5 13l.7 2.4 2.3.6-2.3.6L5 19l-.7-2.4L2 16l2.3-.6L5 13Z" className="fill-current opacity-60" />
        </svg>
      );
    case "key":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
          <path
            d="M10 14a5 5 0 1 1 4.6-7H22v3h-2v2h-2v2h-3.4A5 5 0 0 1 10 14Z"
            className="stroke-current"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M7.2 9.4h.01" className="stroke-current" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "gear":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
          <path
            d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
            className="stroke-current"
            strokeWidth="1.5"
          />
          <path
            d="M19.4 13.1v-2.2l-2-.7a7.6 7.6 0 0 0-.7-1.7l.9-1.9-1.6-1.6-1.9.9c-.6-.3-1.1-.5-1.7-.7l-.7-2H10l-.7 2c-.6.2-1.2.4-1.7.7l-1.9-.9-1.6 1.6.9 1.9c-.3.6-.5 1.1-.7 1.7l-2 .7v2.2l2 .7c.2.6.4 1.2.7 1.7l-.9 1.9 1.6 1.6 1.9-.9c.6.3 1.1.5 1.7.7l.7 2h2.2l.7-2c.6-.2 1.2-.4 1.7-.7l1.9.9 1.6-1.6-.9-1.9c.3-.6.5-1.1.7-1.7l2-.7Z"
            className="stroke-current"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
          <path
            d="M12 2.8l2.7 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.6 6.5 20.2l1.1-6.3L3 9.4l6.3-.9L12 2.8Z"
            className="fill-current"
          />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
          <path
            d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"
            className="stroke-current"
            strokeWidth="1.5"
          />
          <path
            d="M20 20v-1.2a4.4 4.4 0 0 0-4.4-4.4h-1.2A4.4 4.4 0 0 0 10 18.8V20"
            className="stroke-current"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M10 20v-1a4 4 0 0 0-4-4H4.8A3.8 3.8 0 0 0 1 18.8V20"
            className="stroke-current"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function formatRate(dailyRateCents: number, currency: string) {
  return `${(dailyRateCents / 100).toFixed(0)} ${currency}`;
}

type TopListing = {
  id: string;
  title: string;
  city: string;
  country: string;
  dailyRateCents: number;
  currency: string;
  imageUrl: string | null;
  hostRating: number | null;
};

function TopListingsRow({ title, listings }: { title: string; listings: TopListing[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <Link className="text-sm font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground" href="/listings">
          View all
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="flex snap-x snap-mandatory gap-4 pb-2">
          {listings.length === 0 ? (
            <Card className="w-[360px] shrink-0 snap-start border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
              <CardContent className="p-5">
                <div className="text-sm font-semibold">No listings yet</div>
                <div className="mt-1 text-sm text-foreground/60">Approved cars will appear here once hosts publish listings.</div>
              </CardContent>
            </Card>
          ) : null}

          {listings.map((l) => (
            <Card
              key={l.id}
              className="group relative w-[280px] shrink-0 snap-start overflow-hidden border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/18 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-foreground/8 blur-3xl" />
              </div>

              <CardContent className="relative space-y-3 p-0">
                <div className="h-40 w-full overflow-hidden border-b border-border bg-background/30">
                  {l.imageUrl ? (
                    <div className="relative h-full w-full">
                      <Image
                        src={l.imageUrl}
                        alt={l.title}
                        fill
                        sizes="280px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-foreground/10 via-foreground/5 to-transparent text-foreground/70">
                      <Icon name="car" className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-5">
                <div className="rounded-2xl border border-border bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold tracking-tight">{l.title}</div>
                      <div className="mt-0.5 text-xs text-foreground/60">
                        {l.city}, {l.country}
                      </div>
                    </div>
                    {typeof l.hostRating === "number" ? (
                      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-1 text-xs text-foreground/70">
                        <Icon name="star" className="h-4 w-4 text-foreground/70" />
                        <span className="font-medium">{l.hostRating.toFixed(1)}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="text-sm font-semibold">
                      {formatRate(l.dailyRateCents, l.currency)}
                      <span className="text-foreground/50"> / day</span>
                    </div>
                    <div className="text-xs text-foreground/60">Top listing</div>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-foreground/60">Secure payments and instant booking</div>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/listings/${l.id}`}>
                    <Button variant="secondary" className="h-9">View details</Button>
                  </Link>
                  <Link className="text-xs font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground" href="/listings">
                    Browse more
                  </Link>
                </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  type TopListingRaw = {
    id: string;
    title: string;
    city: string;
    country: string;
    dailyRateCents: number;
    currency: string;
    imageUrl: string | null;
    host: { reviewsReceived: Array<{ rating: number }> };
  };

  const now = new Date();
  let topListingsRaw: TopListingRaw[] = [];
  let availableCarsNow = 0;
  let activeHosts = 0;
  let confirmedTrips = 0;

  try {
    const [topListingsRes, availableCarsRes, activeHostsRes, confirmedTripsRes] = await Promise.all([
      prisma.listing.findMany({
        where: {
          status: "ACTIVE",
          isApproved: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          city: true,
          country: true,
          dailyRateCents: true,
          currency: true,
          imageUrl: true,
          host: {
            select: {
              reviewsReceived: {
                select: { rating: true },
              },
            },
          },
        },
      }),
      prisma.listing.count({
        where: {
          status: "ACTIVE",
          isApproved: true,
          bookings: {
            none: {
              status: { in: RESERVED_BOOKING_STATUSES },
              startDate: { lte: now },
              endDate: { gte: now },
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          role: "HOST",
          status: "ACTIVE",
          listings: {
            some: {
              status: "ACTIVE",
              isApproved: true,
            },
          },
        },
      }),
      prisma.booking.count({
        where: {
          status: "CONFIRMED",
        },
      }),
    ]);

    topListingsRaw = topListingsRes;
    availableCarsNow = availableCarsRes;
    activeHosts = activeHostsRes;
    confirmedTrips = confirmedTripsRes;
  } catch {
    topListingsRaw = [];
    availableCarsNow = 0;
    activeHosts = 0;
    confirmedTrips = 0;
  }
  const topListings: TopListing[] = topListingsRaw.map((l) => {
    const ratings = l.host.reviewsReceived.map((r) => r.rating).filter((n) => Number.isFinite(n));
    const hostRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return {
      id: l.id,
      title: l.title,
      city: l.city,
      country: l.country,
      dailyRateCents: l.dailyRateCents,
      currency: l.currency,
      imageUrl: l.imageUrl,
      hostRating,
    };
  });

  const featuredAverageRate = topListings.length
    ? Math.round(topListings.reduce((sum, listing) => sum + listing.dailyRateCents, 0) / topListings.length)
    : 0;

  // Multi-language support
  const lang = "en"; // For demonstration, default to English

  return (
    <main className="relative">
      {/* Language selector */}
      <div className="absolute right-4 top-4 z-10 hidden sm:block">
        <form method="GET" action="/">
          <select name="lang" defaultValue={lang} className="rounded-md border border-border px-2 py-1 text-sm">
            <option value="en">{translations.en.welcome}</option>
            <option value="fr">{translations.fr.welcome}</option>
            <option value="es">{translations.es.welcome}</option>
          </select>
          <Button type="submit" variant="secondary" className="ml-2">Change</Button>
        </form>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10">
        <div className="mx-auto h-[520px] max-w-6xl">
          <div className="absolute left-1/2 top-[-140px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/18 blur-3xl" />
          <div className="absolute right-[-120px] top-[120px] h-[340px] w-[340px] rounded-full bg-foreground/8 blur-3xl" />
          <div className="absolute left-[-120px] top-[180px] h-[340px] w-[340px] rounded-full bg-foreground/6 blur-3xl" />
        </div>
      </div>

      <section className="grid gap-6 sm:gap-8 pb-8 sm:pb-10 pt-4 sm:pt-6 lg:grid-cols-2 lg:items-center lg:gap-10 lg:pb-14">
        <div className="space-y-4 sm:space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-foreground/70 backdrop-blur">
            <span className="inline-flex h-2 w-2 rounded-full bg-accent/70" />
            Cape Town, Johannesburg, Durban
          </div>

            <h1 className="max-w-2xl text-3xl sm:text-4xl lg:text-6xl font-semibold tracking-tight text-foreground lg:leading-[1.02]">
              Move smarter with trusted local cars, flexible pickup, and transparent pricing.
            </h1>
          <p className="max-w-xl text-sm sm:text-base leading-relaxed text-foreground/70">
            From weekend escapes to daily commutes, discover verified vehicles and book in minutes.
          </p>

          <div className="flex flex-wrap gap-2 text-xs text-foreground/70">
            <span className="rounded-full border border-border bg-card/55 px-2.5 py-1">Verified hosts</span>
            <span className="rounded-full border border-border bg-card/55 px-2.5 py-1">Clear pricing</span>
            <span className="rounded-full border border-border bg-card/55 px-2.5 py-1">In-app support</span>
            <span className="rounded-full border border-border bg-card/55 px-2.5 py-1">Roadside assist</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/listings">
              <Button className="h-9 sm:h-11 px-3 sm:px-5 text-sm sm:text-base">Start exploring</Button>
            </Link>
            <Link href="/host">
              <Button variant="secondary" className="h-9 sm:h-11 px-3 sm:px-5 text-sm sm:text-base">List your car</Button>
            </Link>
            <Link className="text-xs sm:text-sm font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground" href="/listings">
              See all vehicles
            </Link>
            <Link className="text-xs sm:text-sm font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground" href="/how-it-works">
              Booking guide
            </Link>
          </div>

          <Card className="relative overflow-hidden border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-accent/16 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-foreground/8 blur-3xl" />
            </div>
            <CardHeader className="relative pb-0">
              <CardTitle className="text-base">Plan your trip</CardTitle>
              <CardDescription>Pick a city, set your dates, and compare options instantly.</CardDescription>
            </CardHeader>
            <CardContent className="relative pt-3 sm:pt-4">
              <form action="/listings" method="GET" className="grid gap-2 sm:gap-3 sm:grid-cols-6 sm:items-end">
                <label className="block sm:col-span-3">
                  <div className="mb-1 text-xs sm:text-sm text-foreground/70">Location</div>
                  <Input name="q" placeholder="e.g. Cape Town" className="text-sm" />
                </label>
                <label className="block sm:col-span-1">
                  <div className="mb-1 text-xs sm:text-sm text-foreground/70">Pickup date</div>
                  <Input name="start" type="date" className="text-sm" />
                </label>
                <label className="block sm:col-span-1">
                  <div className="mb-1 text-xs sm:text-sm text-foreground/70">Return date</div>
                  <Input name="end" type="date" className="text-sm" />
                </label>
                <div className="sm:col-span-1">
                  <Button type="submit" className="w-full text-sm">Show cars</Button>
                </div>
              </form>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-foreground/65">
                <Link className="rounded-full border border-border bg-background/40 px-2.5 py-1 hover:bg-background/70" href="/listings?q=Cape+Town">
                  Cape Town cars
                </Link>
                <Link className="rounded-full border border-border bg-background/40 px-2.5 py-1 hover:bg-background/70" href="/listings?q=Johannesburg">
                  Johannesburg cars
                </Link>
                <Link className="rounded-full border border-border bg-background/40 px-2.5 py-1 hover:bg-background/70" href="/listings?q=Durban">
                  Durban cars
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Card className="relative overflow-hidden border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-accent/18 blur-3xl" />
              <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-foreground/8 blur-3xl" />
            </div>

            <CardHeader className="relative">
              <CardTitle>Premium dashboard</CardTitle>
              <CardDescription>Clean surfaces, readable forms, role-based tools.</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="inline-flex items-center gap-2 text-sm font-medium">
                    <Icon name="car" className="text-foreground/70" />
                    Renter
                  </div>
                  <div className="mt-1 text-sm text-foreground/60">Discover, book, and manage bookings.</div>
                </div>
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="inline-flex items-center gap-2 text-sm font-medium">
                    <Icon name="key" className="text-foreground/70" />
                    Host
                  </div>
                  <div className="mt-1 text-sm text-foreground/60">List vehicles and manage bookings.</div>
                </div>
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="inline-flex items-center gap-2 text-sm font-medium">
                    <Icon name="shield" className="text-foreground/70" />
                    Secure
                  </div>
                  <div className="mt-1 text-sm text-foreground/60">Verified hosts, safe payments.</div>
                </div>
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="inline-flex items-center gap-2 text-sm font-medium">
                    <Icon name="gear" className="text-foreground/70" />
                    Admin
                  </div>
                  <div className="mt-1 text-sm text-foreground/60">Approvals, operations, control.</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background/30 p-4">
                <div className="flex items-center justify-between text-xs text-foreground/60">
                  <span>Bookings</span>
                  <span className="rounded-full border border-border bg-card/60 px-2 py-1">Last 24h</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-10 rounded-xl bg-foreground/10" />
                  <div className="h-10 rounded-xl bg-foreground/10" />
                  <div className="h-10 rounded-xl bg-foreground/10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 pb-6 lg:grid-cols-3">
        {[
          {
            title: "Built for real life trips",
            body: "Daily rentals, weekend escapes, airport pickup, and longer monthly bookings.",
          },
          {
            title: "Clear, trustworthy booking flow",
            body: "Simple checkout, proof-based manual payment flow, and clear booking lifecycle steps.",
          },
          {
            title: "Support that stays with the trip",
            body: "Chat, incidents, and assist tools are linked to bookings for faster resolution.",
          },
        ].map((item) => (
          <Card key={item.title} className="border-border bg-card/55 backdrop-blur supports-[backdrop-filter]:bg-card/40">
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-foreground/70">{item.body}</CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4 pb-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Live mobility index</h2>
          <p className="text-sm text-foreground/60">Quick platform signals to help you choose when and where to book or list.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: "car" as const,
              label: "Cars available now",
              value: availableCarsNow.toLocaleString(),
              hint: "Ready for booking",
            },
            {
              icon: "users" as const,
              label: "Active hosts",
              value: activeHosts.toLocaleString(),
              hint: "Verified profiles",
            },
            {
              icon: "bolt" as const,
              label: "Confirmed trips",
              value: confirmedTrips.toLocaleString(),
              hint: "Completed on platform",
            },
            {
              icon: "sparkles" as const,
              label: "Featured average",
              value: featuredAverageRate > 0 ? formatRate(featuredAverageRate, "ZAR") : "Live soon",
              hint: "Per day rate",
            },
          ].map((metric) => (
            <Card
              key={metric.label}
              className="group relative overflow-hidden border-border bg-card/60 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/18 blur-3xl" />
              </div>
              <CardContent className="relative space-y-3 p-5">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background/40 text-foreground/80">
                  <Icon name={metric.icon} />
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-semibold tracking-tight">{metric.value}</div>
                  <div className="text-sm font-medium text-foreground/80">{metric.label}</div>
                </div>
                <div className="text-xs text-foreground/60">{metric.hint}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 pb-6 lg:grid-cols-2">
        <Card className="relative overflow-hidden border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
          </div>
          <CardContent className="relative p-5 sm:p-6">
            <div className="mb-4 space-y-1">
              <h3 className="text-base font-semibold">Popular pickup hotspots</h3>
              <p className="text-sm text-foreground/60">Plan around areas with high availability and quick pickup windows.</p>
            </div>
            <div className="grid gap-3">
              {[
                { city: "Cape Town CBD", eta: "12 min avg pickup", tag: "High availability" },
                { city: "Johannesburg North", eta: "15 min avg pickup", tag: "Best value" },
                { city: "Durban Central", eta: "18 min avg pickup", tag: "Weekend demand" },
              ].map((spot) => (
                <div key={spot.city} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/35 p-3">
                  <div>
                    <div className="text-sm font-semibold">{spot.city}</div>
                    <div className="text-xs text-foreground/60">{spot.eta}</div>
                  </div>
                  <div className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-foreground/70">{spot.tag}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-foreground/10 blur-3xl" />
          </div>
          <CardContent className="relative p-5 sm:p-6">
            <div className="mb-4 space-y-1">
              <h3 className="text-base font-semibold">How booking works</h3>
              <p className="text-sm text-foreground/60">Simple flow, built for speed from search to key handoff.</p>
            </div>
            <ol className="space-y-3">
              {[
                { title: "Find your match", desc: "Filter by city, date, and price in seconds." },
                { title: "Book instantly", desc: "Secure checkout and verified hosts keep it smooth." },
                { title: "Pick up and drive", desc: "Coordinate pickup details directly from your dashboard." },
              ].map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-border bg-background/35 p-3">
                  <div className="text-xs font-medium text-foreground/60">Step {index + 1}</div>
                  <div className="mt-1 text-sm font-semibold">{step.title}</div>
                  <div className="mt-0.5 text-xs text-foreground/60">{step.desc}</div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4 pb-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Trip confidence</h2>
          <p className="text-sm text-foreground/60">What renters and hosts can expect before, during, and after every trip.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Before pickup",
              text: "Review requirements, upload docs once, and prepare handover photos.",
            },
            {
              title: "During trip",
              text: "Use booking chat for host/admin coordination and route support issues quickly.",
            },
            {
              title: "Unexpected events",
              text: "Use Assist to pin location and open incidents with context in one place.",
            },
            {
              title: "After return",
              text: "Access receipts, leave ratings, and maintain transparent trip history.",
            },
          ].map((item) => (
            <Card key={item.title} className="border-border bg-card/55 backdrop-blur supports-[backdrop-filter]:bg-card/40">
              <CardHeader>
                <CardTitle className="text-sm">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-foreground/70">{item.text}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4 pb-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Pick your lane</h2>
          <p className="text-sm text-foreground/60">Purpose-built tools for renters, hosts, and operations teams.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: "car" as const,
              title: "Renter",
              desc: "Find and book a verified car in under a minute.",
              cta: "Browse cars",
              href: "/listings",
            },
            {
              icon: "key" as const,
              title: "Host",
              desc: "List your car, accept bookings, and grow monthly earnings.",
              cta: "Open host dashboard",
              href: "/host",
            },
            {
              icon: "gear" as const,
              title: "Admin",
              desc: "Review listings, monitor platform health, and manage payouts.",
              cta: "Admin console",
              href: "/admin",
            },
          ].map((r) => (
            <Card
              key={r.title}
              className="group relative overflow-hidden border-border bg-card/60 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/18 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-foreground/8 blur-3xl" />
              </div>
              <CardContent className="relative flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold">{r.title}</div>
                    <div className="mt-1 text-sm text-foreground/60">{r.desc}</div>
                  </div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background/40 text-foreground/80">
                    <Icon name={r.icon} />
                  </div>
                </div>
                <div className="mt-auto">
                  <Link href={r.href}>
                    <Button variant="secondary" className="w-full">
                      {r.cta}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-5 pb-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Featured cars</h2>
          <p className="text-sm text-foreground/60">Top five listings right now.</p>
        </div>

        <TopListingsRow title="Top listings" listings={topListings} />
      </section>

      <section className="pb-12">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 px-6 py-10 text-center backdrop-blur supports-[backdrop-filter]:bg-card/40 sm:px-10">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-accent/22 blur-3xl" />
            <div className="absolute -right-24 -bottom-28 h-80 w-80 rounded-full bg-foreground/10 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-2xl space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight">Ready for your next drive?</h2>
            <p className="text-sm text-foreground/70">Create your account, compare cars, and book with confidence.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Link href="/sign-up">
                <Button className="h-11 px-5 text-base">Create account</Button>
              </Link>
              <Link href="/sign-in">
                <Button variant="secondary" className="h-11 px-5 text-base">Sign in</Button>
              </Link>
            </div>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <a href="https://itunes.apple.com/app/relayrides/id555063314?mt=8&ls=1" target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted">
                  <svg aria-hidden className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.67 2.85c-1.13 0-2.36.77-3.19 1.7-.83-.93-2.06-1.7-3.19-1.7C7.13 2.85 5 5.13 5 8.13c0 2.97 2.13 6.13 4.13 8.13 1.13 1.13 2.36 1.7 3.19 1.7.83 0 2.06-.57 3.19-1.7C16.87 14.26 19 11.1 19 8.13c0-3-2.13-5.28-4.13-5.28Zm-3.19 14.28c-.83 0-2.06-.57-3.19-1.7C7.13 14.26 5 11.1 5 8.13c0-3 2.13-5.28 4.13-5.28 1.13 0 2.36.77 3.19 1.7.83-.93 2.06-1.7 3.19-1.7C16.87 2.85 19 5.13 19 8.13c0 2.97-2.13 6.13-4.13 8.13-1.13 1.13-2.36 1.7-3.19 1.7Z"/></svg>
                  Download on the App Store
                </a>
                <a href="https://play.google.com/store/apps/details?id=com.relayrides.android.relayrides" target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted">
                  <svg aria-hidden className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 2.5v19l17-9.5-17-9.5zm2.5 3.5l11.5 6.5-11.5 6.5v-13z"/></svg>
                  Get it on Google Play
                </a>
              </div>
          </div>
        </div>
      </section>
    </main>
  );
}
