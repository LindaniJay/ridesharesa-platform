import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cities • RideShare",
};

function slugifyCity(city: string) {
  return city
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function CitiesIndexPage() {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE", isApproved: true },
    select: { city: true, country: true },
    take: 500,
  });

  const byCity = new Map<string, { city: string; country: string; count: number }>();
  for (const l of listings) {
    const key = `${l.city}||${l.country}`;
    const prev = byCity.get(key);
    byCity.set(key, {
      city: l.city,
      country: l.country,
      count: (prev?.count ?? 0) + 1,
    });
  }

  const rows = Array.from(byCity.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.city.localeCompare(b.city);
  });

  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Cities</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          Browse listings by city. City pages are generated from approved active listings.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No city pages yet</CardTitle>
            <CardDescription>City pages appear once you have approved listings.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              Browse all listings in <Link className="underline" href="/listings">Listings</Link>.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const slug = slugifyCity(r.city);
            return (
              <Card key={`${r.city}-${r.country}`}>
                <CardHeader>
                  <CardTitle>{r.city}</CardTitle>
                  <CardDescription>{r.country}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="text-black/60 dark:text-white/60">{r.count} listing(s)</div>
                    <Link className="underline" href={`/cities/${slug}`}>Explore</Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search across all listings</CardTitle>
          <CardDescription>Use the listings search page for dates and sorting.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            <Link className="underline" href="/listings">Go to listings</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
