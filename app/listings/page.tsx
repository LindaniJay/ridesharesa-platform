import Link from "next/link";
import Image from "next/image";

import ListingMap from "@/app/components/ListingMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
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

  const orderBy =
    sort === "price_asc"
      ? ({ dailyRateCents: "asc" } as const)
      : sort === "price_desc"
        ? ({ dailyRateCents: "desc" } as const)
        : ({ createdAt: "desc" } as const);

    const now = new Date();
    const reservedStatuses: Array<"PENDING_APPROVAL" | "CONFIRMED"> = ["PENDING_APPROVAL", "CONFIRMED"];

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
              status: { in: reservedStatuses },
              startDate: { lt: endDate! },
              endDate: { gt: startDate! },
            }
          : {
              status: { in: reservedStatuses },
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
    },
  });

  const carry = new URLSearchParams();
  if (start) carry.set("start", start);
  if (end) carry.set("end", end);
  const carryQS = carry.toString();

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Browse approved cars near you.</p>
      </div>

      <Card>
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
                className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-black/20 dark:border-white/10 dark:focus-visible:ring-white/20"
              >
                <option value="recent">Most recent</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
            <div className="sm:col-span-6 flex flex-wrap items-center gap-2">
              <Button type="submit">Update results</Button>
              {(q || start || end || (sort && sort !== "recent")) && (
                <Link className="text-sm underline" href="/listings">
                  Clear
                </Link>
              )}
              <div className="text-sm text-black/60 dark:text-white/60">{listings.length} result(s)</div>
            </div>
          </form>
        </CardContent>
      </Card>

      <ListingMap listings={listings} />

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
      )}
    </main>
  );
}
