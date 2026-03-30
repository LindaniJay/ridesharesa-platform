import Link from "next/link";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import DocumentsUploadForm from "@/app/components/DocumentsUploadForm.client";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";
import {
  badgeVariantForBookingStatus,
  badgeVariantForListingStatus,
  badgeVariantForPayoutStatus,
  badgeVariantForSupportTicketStatus,
  badgeVariantForVerificationStatus,
} from "@/app/lib/badgeVariants";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function HostDashboardPage() {
  const { dbUser, supabaseUser } = await requireRole("HOST");
  const hostId = dbUser.id;

  const userDocsBucket = process.env.SUPABASE_USER_DOCS_BUCKET || "user-documents";
  const profileImagePath =
    typeof supabaseUser.user_metadata?.profileImagePath === "string"
      ? supabaseUser.user_metadata.profileImagePath
      : null;
  const proofOfResidencePath =
    typeof supabaseUser.user_metadata?.proofOfResidenceImagePath === "string"
      ? supabaseUser.user_metadata.proofOfResidenceImagePath.trim()
      : "";
  const proofOfResidenceIssuedAtRaw =
    typeof supabaseUser.user_metadata?.proofOfResidenceIssuedAt === "string"
      ? supabaseUser.user_metadata.proofOfResidenceIssuedAt
      : null;
  const proofOfResidenceIssuedAt =
    proofOfResidenceIssuedAtRaw && !Number.isNaN(new Date(proofOfResidenceIssuedAtRaw).getTime())
      ? iso(new Date(proofOfResidenceIssuedAtRaw))
      : null;
  const hasProofOfResidence = proofOfResidencePath.length > 0;
  let profileImageSignedUrl: string | null = null;
  if (profileImagePath) {
    const { data } = await supabaseAdmin().storage.from(userDocsBucket).createSignedUrl(profileImagePath, 60 * 10);
    if (data?.signedUrl) profileImageSignedUrl = data.signedUrl;
  }

  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [
    listings,
    upcomingBookings,
    activeBookings,
    pastBookings,
    recentMessages,
    supportTickets,
    confirmedTotals,
    pendingPayouts,
    paidPayouts,
    recentPayouts,
    pendingActionBookingsCount,
    urgentUpcomingCount,
    recentConfirmedForPerformance,
  ] = await Promise.all([
    prisma.listing.findMany({
      where: { hostId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        city: true,
        imageUrl: true,
        dailyRateCents: true,
        currency: true,
        status: true,
        isApproved: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        listing: { hostId },
        status: "CONFIRMED",
        startDate: { gt: now },
      },
      orderBy: { startDate: "asc" },
      take: 20,
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        totalCents: true,
        currency: true,
        renter: { select: { email: true, name: true } },
        listing: { select: { title: true, city: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        listing: { hostId },
        status: "CONFIRMED",
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { startDate: "asc" },
      take: 20,
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        totalCents: true,
        currency: true,
        renter: { select: { email: true, name: true } },
        listing: { select: { title: true, city: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        listing: { hostId },
        status: { in: ["CONFIRMED", "CANCELLED"] },
        endDate: { lt: now },
      },
      orderBy: { endDate: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        totalCents: true,
        currency: true,
        renter: { select: { email: true, name: true } },
        listing: { select: { title: true, city: true } },
      },
    }),
    prisma.bookingMessage.findMany({
      where: {
        booking: {
          listing: { hostId },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        body: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            listing: { select: { title: true } },
            renter: { select: { email: true, name: true } },
          },
        },
        sender: { select: { email: true, name: true, role: true } },
      },
    }),
    prisma.supportTicket.findMany({
      where: { userId: hostId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, subject: true, status: true, createdAt: true },
    }),
    prisma.booking.aggregate({
      where: {
        listing: { hostId },
        status: "CONFIRMED",
      },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
    prisma.hostPayout.aggregate({
      where: { hostId, status: "PENDING" },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.hostPayout.aggregate({
      where: { hostId, status: "PAID" },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.hostPayout.findMany({
      where: { hostId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        amountCents: true,
        currency: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        createdAt: true,
      },
    }),
    prisma.booking.count({
      where: {
        listing: { hostId },
        status: { in: ["PENDING_PAYMENT", "PENDING_APPROVAL"] },
      },
    }),
    prisma.booking.count({
      where: {
        listing: { hostId },
        status: "CONFIRMED",
        startDate: { gte: now, lte: twoDaysFromNow },
      },
    }),
    prisma.booking.findMany({
      where: {
        listing: { hostId },
        status: "CONFIRMED",
        createdAt: { gte: monthAgo },
      },
      select: {
        id: true,
        listingId: true,
        totalCents: true,
        startDate: true,
        endDate: true,
      },
      take: 500,
    }),
  ]);

  const totalEarningsCents = confirmedTotals._sum.totalCents ?? 0;
  const confirmedTrips = confirmedTotals._count._all;
  const pendingPayoutCents = pendingPayouts._sum.amountCents ?? 0;
  const pendingPayoutCount = pendingPayouts._count._all;
  const paidPayoutCents = paidPayouts._sum.amountCents ?? 0;
  const paidPayoutCount = paidPayouts._count._all;
  const unapprovedListingsCount = listings.filter((l) => !l.isApproved).length;

  const listingTitleById = new Map(listings.map((l) => [l.id, l.title] as const));
  const listingPerformanceMap = new Map<string, { trips: number; revenueCents: number; bookedDays: number }>();
  for (const booking of recentConfirmedForPerformance) {
    const existing = listingPerformanceMap.get(booking.listingId) ?? { trips: 0, revenueCents: 0, bookedDays: 0 };
    const durationDays = Math.max(
      1,
      Math.ceil((booking.endDate.getTime() - booking.startDate.getTime()) / (24 * 60 * 60 * 1000)),
    );
    listingPerformanceMap.set(booking.listingId, {
      trips: existing.trips + 1,
      revenueCents: existing.revenueCents + booking.totalCents,
      bookedDays: existing.bookedDays + durationDays,
    });
  }

  const listingPerformanceRows = Array.from(listingPerformanceMap.entries())
    .map(([listingId, perf]) => ({
      listingId,
      title: listingTitleById.get(listingId) ?? "Unknown listing",
      trips: perf.trips,
      revenueCents: perf.revenueCents,
      bookedDays: perf.bookedDays,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 8);

  async function createSupportTicket(formData: FormData) {
    "use server";

    const { dbUser } = await requireRole("HOST");
    const subject = String(formData.get("subject") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    if (!subject || !message) return;

    await prisma.supportTicket.create({
      data: {
        userId: dbUser.id,
        subject,
        message,
      },
    });

    revalidatePath("/host");
  }

  return (
    <main className="min-h-screen space-y-8 pb-12 mobile-tight stagger-children">
      {/* Hero Header with community badges */}
      <Card className="rounded-3xl p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Welcome back, Host!</h1>
            <p className="text-lg text-muted-foreground">Manage your vehicles, bookings, and earnings in one place.</p>
            {/* Community badges */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="success">All-Star Host</Badge>
              <Badge variant="info">Verified</Badge>
              {confirmedTrips > 10 && <Badge variant="info">Top Host</Badge>}
              {confirmedTrips > 0 && <Badge variant="neutral">{confirmedTrips} trips</Badge>}
            </div>
          </div>
          <Link href="/host/listings/new">
            <Button>
              <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Vehicle
            </Button>
          </Link>
        </div>
      </Card>

      {/* Key Metrics */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Business Overview</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R{(totalEarningsCents / 100).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{confirmedTrips} bookings</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R{(pendingPayoutCents / 100).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{pendingPayoutCount} payment{pendingPayoutCount !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Paid Out</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R{(paidPayoutCents / 100).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{paidPayoutCount} completed</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeBookings.length}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{confirmedTrips + pastBookings.length}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Operations & alerts</h2>
        <div className="grid gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending actions</CardTitle>
              <CardDescription>Bookings waiting for payment or approval.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{pendingActionBookingsCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Starts in 48h</CardTitle>
              <CardDescription>Confirmed trips needing handover prep.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{urgentUpcomingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Listings under review</CardTitle>
              <CardDescription>Vehicles not yet approved by admin.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{unapprovedListingsCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Support tickets</CardTitle>
              <CardDescription>Open and historical host requests.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{supportTickets.length}</div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Profile & verification</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Host snapshot</CardTitle>
              <CardDescription>Your current verification overview.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              {profileImageSignedUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profileImageSignedUrl}
                    alt="Profile"
                    className="h-14 w-14 rounded-full border object-cover"
                  />
                </>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-xs text-foreground/60">No photo</div>
              )}
              <div className="text-xs text-foreground/70">
                <div>{dbUser.name || "Host"}</div>
                <div>{dbUser.email}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Driver&apos;s license</CardTitle>
              <CardDescription>Verification status stored in your profile.</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={badgeVariantForVerificationStatus(dbUser.driversLicenseStatus)}>{dbUser.driversLicenseStatus}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>ID verification</CardTitle>
              <CardDescription>Verification status stored in your profile.</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={badgeVariantForVerificationStatus(dbUser.idVerificationStatus)}>{dbUser.idVerificationStatus}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Proof of residence</CardTitle>
              <CardDescription>Required document not older than 3 months.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge variant={hasProofOfResidence ? "success" : "warning"}>
                {hasProofOfResidence ? "UPLOADED" : "MISSING"}
              </Badge>
              <div className="text-xs text-foreground/60">
                {proofOfResidenceIssuedAt
                  ? `Issue date: ${proofOfResidenceIssuedAt}`
                  : "Issue date not submitted yet."}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload or update documents</CardTitle>
            <CardDescription>Keep your host verification pack current.</CardDescription>
          </CardHeader>
          <CardContent>
            <form>
              <DocumentsUploadForm successHref="/host" nextHref="/host" />
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payout history</h2>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/host/exports/payouts"
            className="btn-link-secondary"
          >
            Download my payouts (CSV)
          </a>
        </div>
        {recentPayouts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No payouts yet</CardTitle>
              <CardDescription>Payout records created by admin will show here.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
            <table className="dashboard-table">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentPayouts.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2">{(p.amountCents / 100).toFixed(0)} {p.currency}</td>
                    <td className="px-3 py-2"><Badge variant={badgeVariantForPayoutStatus(p.status)}>{p.status}</Badge></td>
                    <td className="px-3 py-2">{p.periodStart ? iso(p.periodStart) : "-"} → {p.periodEnd ? iso(p.periodEnd) : "-"}</td>
                    <td className="px-3 py-2">{iso(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vehicle management</h2>
        {listings.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No vehicles yet</CardTitle>
              <CardDescription>Add your first vehicle listing to start earning.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/host/listings/new">
                <Button>Create listing</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <Card key={l.id}>
                <CardHeader>
                  <CardTitle>{l.title}</CardTitle>
                  <CardDescription>{l.city}</CardDescription>
                </CardHeader>
                <CardContent>
                  {l.imageUrl ? (
                    <div className="mb-3 overflow-hidden rounded-xl border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={l.imageUrl}
                        alt={l.title}
                        className="h-36 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="mb-3 flex h-36 w-full items-center justify-center rounded-xl border border-border bg-muted text-sm text-foreground/60">
                      No vehicle photo
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      {(l.dailyRateCents / 100).toFixed(0)} {l.currency}
                      <span className="text-foreground/50"> / day</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={badgeVariantForListingStatus(l.status)}>{l.status}</Badge>
                      <Badge variant={l.isApproved ? "success" : "warning"}>
                        {l.isApproved ? "Approved" : "Under review"}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Link className="text-sm font-medium underline" href={`/listings/${l.id}`}>
                      View public page
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Booking management</h2>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/host/exports/bookings"
            className="btn-link-secondary"
          >
            Download my bookings (CSV)
          </a>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Requests</CardTitle>
              <CardDescription>Pending payments (proxy for pending requests).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-foreground/60">
                Approval/decline flows and messaging aren’t enabled yet.
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming</CardTitle>
              <CardDescription>Next scheduled bookings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingBookings.length === 0 ? (
                <div className="text-sm text-foreground/60">No upcoming bookings.</div>
              ) : (
                upcomingBookings.map((b) => (
                  <div key={b.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{b.listing.title}</div>
                        <div className="text-foreground/60">
                          Renter: {(b.renter.name && b.renter.name.trim()) || b.renter.email}
                        </div>
                      </div>
                      <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                    </div>
                    <div className="mt-2 text-foreground/70">
                      {iso(b.startDate)} → {iso(b.endDate)}
                    </div>
                    <div className="mt-2">
                      <Link className="text-sm font-medium underline" href={`/bookings/${b.id}`}>
                        Open booking
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bookings in progress</CardTitle>
              <CardDescription>Currently active rentals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeBookings.length === 0 ? (
                <div className="text-sm text-foreground/60">No active bookings.</div>
              ) : (
                activeBookings.map((b) => (
                  <div key={b.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{b.listing.title}</div>
                        <div className="text-foreground/60">
                          Renter: {(b.renter.name && b.renter.name.trim()) || b.renter.email}
                        </div>
                      </div>
                      <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                    </div>
                    <div className="mt-2 text-foreground/70">
                      {iso(b.startDate)} → {iso(b.endDate)}
                    </div>
                    <div className="mt-2">
                      <Link className="text-sm font-medium underline" href={`/bookings/${b.id}`}>
                        Open booking
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Past bookings</CardTitle>
            <CardDescription>Recent completed/cancelled bookings.</CardDescription>
          </CardHeader>
          <CardContent>
            {pastBookings.length === 0 ? (
              <div className="text-sm text-foreground/60">No past bookings.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="dashboard-table">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2">Vehicle</th>
                      <th className="px-3 py-2">Renter</th>
                      <th className="px-3 py-2">Dates</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastBookings.map((b) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="px-3 py-2">{b.listing.title}</td>
                        <td className="px-3 py-2">{b.renter.email}</td>
                        <td className="px-3 py-2">
                          {iso(b.startDate)} → {iso(b.endDate)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          {(b.totalCents / 100).toFixed(0)} {b.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Messages</h2>
        {recentMessages.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No messages yet</CardTitle>
              <CardDescription>Messages show up when you, a renter, or an admin chats on a booking.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentMessages.map((m) => {
              const senderName = (m.sender.name && m.sender.name.trim()) || m.sender.email;
              const renterName =
                (m.booking.renter.name && m.booking.renter.name.trim()) || m.booking.renter.email;
              return (
                <Card key={m.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{m.booking.listing.title}</CardTitle>
                    <CardDescription>
                      {senderName} ({m.sender.role}), renter: {renterName}, {new Date(m.createdAt).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm text-foreground/80">{m.body}</div>
                    <Link className="text-sm font-medium underline" href={`/bookings/${m.booking.id}`}>
                      Open chat
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Earnings & financials</h2>
        <Card>
          <CardHeader>
            <CardTitle>Payout history</CardTitle>
            <CardDescription>Host payouts can be recorded as platform operations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-foreground/60">
              Payout automation, fee breakdowns, and tax docs aren’t enabled yet.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Safety & support</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Report an issue</CardTitle>
              <CardDescription>Create a support ticket for damage/issues.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createSupportTicket} className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-sm">Subject</div>
                  <Input name="subject" required />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">Message</div>
                  <Textarea name="message" required rows={4} />
                </label>
                <Button className="w-full">Submit ticket</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your tickets</CardTitle>
              <CardDescription>Recent tickets and statuses.</CardDescription>
            </CardHeader>
            <CardContent>
              {supportTickets.length === 0 ? (
                <div className="text-sm text-foreground/60">No tickets yet.</div>
              ) : (
                <div className="space-y-2">
                  {supportTickets.map((t) => (
                    <div key={t.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{t.subject}</div>
                        <Badge variant={badgeVariantForSupportTicketStatus(t.status)}>{t.status}</Badge>
                      </div>
                      <div className="mt-1 text-foreground/60">Created {iso(t.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Optimization tools</h2>
        <Card>
          <CardHeader>
            <CardTitle>Top listing performance (30 days)</CardTitle>
            <CardDescription>Revenue and utilization by listing from confirmed trips.</CardDescription>
          </CardHeader>
          <CardContent>
            {listingPerformanceRows.length === 0 ? (
              <div className="text-sm text-foreground/60">No confirmed bookings in the last 30 days.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="dashboard-table">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2">Listing</th>
                      <th className="px-3 py-2">Trips</th>
                      <th className="px-3 py-2">Booked days</th>
                      <th className="px-3 py-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listingPerformanceRows.map((row) => (
                      <tr key={row.listingId} className="border-t border-border">
                        <td className="px-3 py-2">{row.title}</td>
                        <td className="px-3 py-2">{row.trips}</td>
                        <td className="px-3 py-2">{row.bookedDays}</td>
                        <td className="px-3 py-2">R{(row.revenueCents / 100).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
