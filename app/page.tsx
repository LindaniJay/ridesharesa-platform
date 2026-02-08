import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { prisma } from "@/app/lib/prisma";

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

              <CardContent className="relative space-y-3 p-5">
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
                  <div className="text-xs text-foreground/60">Secure payments • Instant booking</div>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/listings/${l.id}`}>
                    <Button variant="secondary" className="h-9">View details</Button>
                  </Link>
                  <Link className="text-xs font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground" href="/listings">
                    Browse more
                  </Link>
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
  const topListingsRaw = await prisma.listing.findMany({
    where: { status: "ACTIVE", isApproved: true },
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
            take: 50,
          },
        },
      },
    },
  });

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

  return (
    <main className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10">
        <div className="mx-auto h-[520px] max-w-6xl">
          <div className="absolute left-1/2 top-[-140px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/18 blur-3xl" />
          <div className="absolute right-[-120px] top-[120px] h-[340px] w-[340px] rounded-full bg-foreground/8 blur-3xl" />
          <div className="absolute left-[-120px] top-[180px] h-[340px] w-[340px] rounded-full bg-foreground/6 blur-3xl" />
        </div>
      </div>

      <section className="grid gap-8 pb-10 pt-6 lg:grid-cols-2 lg:items-center lg:gap-10 lg:pb-14">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-foreground/70 backdrop-blur">
            <span className="inline-flex h-2 w-2 rounded-full bg-accent/70" />
            Clean, secure car rentals
          </div>

          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.02]">
            Rent and share cars with total confidence.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-foreground/70">
            A premium marketplace for renters, hosts, and admins.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/listings">
              <Button className="h-11 px-5 text-base">Find a car</Button>
            </Link>
            <Link href="/host">
              <Button variant="secondary" className="h-11 px-5 text-base">Become a host</Button>
            </Link>
            <Link className="text-sm font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground" href="/listings">
              Browse listings
            </Link>
            <Link className="text-sm font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground" href="/how-it-works">
              How it works
            </Link>
          </div>

          <Card className="relative overflow-hidden border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-accent/16 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-foreground/8 blur-3xl" />
            </div>
            <CardHeader className="relative pb-0">
              <CardTitle className="text-base">Search</CardTitle>
              <CardDescription>Location, pickup date, return date.</CardDescription>
            </CardHeader>
            <CardContent className="relative pt-4">
              <form action="/listings" method="GET" className="grid gap-3 sm:grid-cols-6 sm:items-end">
                <label className="block sm:col-span-3">
                  <div className="mb-1 text-sm text-foreground/70">Location</div>
                  <Input name="q" placeholder="e.g. Cape Town" />
                </label>
                <label className="block sm:col-span-1">
                  <div className="mb-1 text-sm text-foreground/70">Pickup date</div>
                  <Input name="start" type="date" />
                </label>
                <label className="block sm:col-span-1">
                  <div className="mb-1 text-sm text-foreground/70">Return date</div>
                  <Input name="end" type="date" />
                </label>
                <div className="sm:col-span-1">
                  <Button type="submit" className="w-full">Search</Button>
                </div>
              </form>
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
                  <div className="mt-1 text-sm text-foreground/60">Discover, book, and manage trips.</div>
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

      <section className="space-y-4 pb-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Why choose us</h2>
          <p className="text-sm text-foreground/60">High-trust marketplace, designed for speed and clarity.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: "shield" as const,
              title: "Trusted & secure",
              desc: "Verified hosts, safe payments, optional insurance.",
            },
            {
              icon: "bolt" as const,
              title: "Fast booking",
              desc: "Reserve a car in seconds.",
            },
            {
              icon: "car" as const,
              title: "Made for renters & hosts",
              desc: "Easy dashboard tools for both sides.",
            },
            {
              icon: "sparkles" as const,
              title: "Professional design",
              desc: "Consistent UI, readable forms, clean components.",
            },
          ].map((v) => (
            <Card
              key={v.title}
              className="group relative overflow-hidden border-border bg-card/60 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/18 blur-3xl" />
              </div>
              <CardContent className="relative space-y-2 p-5">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background/40 text-foreground/80">
                  <Icon name={v.icon} />
                </div>
                <div className="text-sm font-semibold">{v.title}</div>
                <div className="text-sm text-foreground/60">{v.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4 pb-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Choose your role</h2>
          <p className="text-sm text-foreground/60">Interactive dashboards built for each workflow.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: "car" as const,
              title: "Renter",
              desc: "Discover and book cars instantly.",
              cta: "Browse cars",
              href: "/listings",
            },
            {
              icon: "key" as const,
              title: "Host",
              desc: "List your car and manage bookings easily.",
              cta: "Open host dashboard",
              href: "/host",
            },
            {
              icon: "gear" as const,
              title: "Admin",
              desc: "Approve listings, manage users, and control the platform.",
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
            <h2 className="text-2xl font-semibold tracking-tight">Ready to get started?</h2>
            <p className="text-sm text-foreground/70">Join as a renter or a host.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Link href="/sign-up">
                <Button className="h-11 px-5 text-base">Create account</Button>
              </Link>
              <Link href="/sign-in">
                <Button variant="secondary" className="h-11 px-5 text-base">Sign in</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
