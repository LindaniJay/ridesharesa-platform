import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import ListingMap from "@/app/components/ListingMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

type CityPageProps = {
  params: Promise<{ city: string }>;
};

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/['’]/g, "");
}

function slugifyCity(city: string) {
  return city
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function CityPage({ params }: CityPageProps) {
  const resolvedParams = await params;
  const citySlug = normalize(decodeURIComponent(resolvedParams.city));

  const now = new Date();
  const reservedStatuses: Array<"PENDING_APPROVAL" | "CONFIRMED"> = ["PENDING_APPROVAL", "CONFIRMED"];

  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      isApproved: true,
      bookings: {
        none: {
          status: { in: reservedStatuses },
          startDate: { lte: now },
          endDate: { gte: now },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
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
    },
  });

  const cityListings = listings.filter((l) => slugifyCity(l.city) === citySlug);

  if (cityListings.length === 0) notFound();

  const cityName = cityListings[0]!.city;
  const countryName = cityListings[0]!.country;

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Car rentals in {cityName}</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Browse approved listings in {cityName}, {countryName}.
        </p>
      </div>

      <ListingMap listings={cityListings} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cityListings.map((l) => (
          <Link key={l.id} href={`/listings/${l.id}`} className="group">
            <div className="rounded-xl border border-black/10 bg-background p-4 shadow-sm shadow-black/5 transition-colors group-hover:bg-black/5 dark:border-white/10 dark:shadow-black/20 dark:group-hover:bg-white/10">
              {l.imageUrl ? (
                <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
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
              <div className="mt-1 text-sm text-black/60 dark:text-white/60">
                {l.city}, {l.country}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm">
                  {(l.dailyRateCents / 100).toFixed(0)} {l.currency}
                  <span className="text-black/50 dark:text-white/50"> / day</span>
                </div>
                <div className="text-sm font-medium underline">View</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Not finding what you need?</CardTitle>
          <CardDescription>Try searching all listings.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            <Link className="underline" href="/listings">
              Go to listings
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
