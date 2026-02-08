import { revalidatePath } from "next/cache";
import Link from "next/link";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import {
  badgeVariantForBookingStatus,
  badgeVariantForIncidentStatus,
  badgeVariantForListingStatus,
  badgeVariantForPayoutStatus,
  badgeVariantForRole,
  badgeVariantForSupportTicketStatus,
  badgeVariantForUserStatus,
  badgeVariantForVerificationStatus,
} from "@/app/lib/badgeVariants";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";
import type {
  BookingStatus,
  IncidentStatus,
  IncidentType,
  ListingStatus,
  PayoutStatus,
  Role,
  SupportTicketStatus,
  UserStatus,
  VerificationStatus,
} from "@prisma/client";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseStatus<T extends string>(value: unknown, allowed: readonly T[]) {
  const v = String(value ?? "");
  return allowed.includes(v as T) ? (v as T) : null;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; bookingStatus?: string; ticketStatus?: string; incidentStatus?: string }>;
}) {
  await requireRole("ADMIN");

  const resolved = searchParams ? await searchParams : undefined;
  const q = (resolved?.q ?? "").trim();
  const bookingStatus = parseStatus<BookingStatus>(resolved?.bookingStatus, [
    "PENDING_PAYMENT",
    "CONFIRMED",
    "CANCELLED",
  ] as const);
  const ticketStatus = parseStatus<SupportTicketStatus>(resolved?.ticketStatus, [
    "OPEN",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
  ] as const);
  const incidentStatus = parseStatus<IncidentStatus>(resolved?.incidentStatus, [
    "OPEN",
    "IN_REVIEW",
    "RESOLVED",
    "CLOSED",
  ] as const);

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    pendingListings,
    allUsers,
    recentBookings,
    totalUsers,
    totalCars,
    totalBookingsAll,
    bookingsDaily,
    bookingsWeekly,
    bookingsMonthly,
    grossRevenue,
    activeRentalsNow,
    cancellations,
    openTicketsCount,
    openIncidentsCount,
    listingsAll,
    bookingsOps,
    supportTickets,
    incidentReports,
    hostsForPayout,
    recentPayouts,
    pendingPayoutAgg,
    paidPayoutAgg,
  ] = await Promise.all([
    prisma.listing.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        city: true,
        status: true,
        createdAt: true,
        host: { select: { email: true } },
      },
    }),
    prisma.user.findMany({
      where: q
        ? {
            email: { contains: q.toLowerCase(), mode: "insensitive" },
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        idVerificationStatus: true,
        driversLicenseStatus: true,
        createdAt: true,
      },
    }),
    prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        renter: { select: { email: true } },
        listing: { select: { title: true } },
      },
    }),
    prisma.user.count(),
    prisma.listing.count(),
    prisma.booking.count(),
    prisma.booking.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.booking.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.booking.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.booking.aggregate({
      where: { status: "CONFIRMED" },
      _sum: { totalCents: true },
    }),
    prisma.booking.count({
      where: {
        status: "CONFIRMED",
        startDate: { lte: now },
        endDate: { gte: now },
      },
    }),
    prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.incidentReport.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.listing.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        city: true,
        status: true,
        isApproved: true,
        createdAt: true,
        host: { select: { email: true } },
      },
    }),
    prisma.booking.findMany({
      where: bookingStatus ? { status: bookingStatus } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        stripeCheckoutSessionId: true,
        startDate: true,
        endDate: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        renter: { select: { email: true } },
        listing: { select: { id: true, title: true, city: true, host: { select: { email: true } } } },
      },
    }),
    prisma.supportTicket.findMany({
      where: ticketStatus ? { status: ticketStatus } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
        user: { select: { email: true, role: true } },
      },
    }),
    prisma.incidentReport.findMany({
      where: incidentStatus ? { status: incidentStatus } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        createdAt: true,
        user: { select: { email: true, role: true } },
        bookingId: true,
        listingId: true,
      },
    }),
    prisma.user.findMany({
      where: { role: "HOST" },
      orderBy: { email: "asc" },
      select: { id: true, email: true },
      take: 200,
    }),
    prisma.hostPayout.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        amountCents: true,
        currency: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        createdAt: true,
        host: { select: { email: true } },
      },
    }),
    prisma.hostPayout.aggregate({
      where: { status: "PENDING" },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.hostPayout.aggregate({
      where: { status: "PAID", createdAt: { gte: monthAgo } },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
  ]);

  async function approveListing(formData: FormData) {
    "use server";
    const listingId = String(formData.get("listingId") ?? "");
    if (!listingId) return;
    await prisma.listing.update({ where: { id: listingId }, data: { isApproved: true } });
    revalidatePath("/listings");
    revalidatePath("/admin");
  }

  async function setListingStatus(formData: FormData) {
    "use server";
    const listingId = String(formData.get("listingId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!listingId) return;
    if (!['ACTIVE', 'PAUSED', 'DRAFT'].includes(status)) return;
    await prisma.listing.update({ where: { id: listingId }, data: { status: status as ListingStatus } });
    revalidatePath("/listings");
    revalidatePath("/admin");
  }

  async function setUserRole(formData: FormData) {
    "use server";
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "");
    if (!userId) return;
    if (!['ADMIN', 'HOST', 'RENTER'].includes(role)) return;
    await prisma.user.update({ where: { id: userId }, data: { role: role as Role } });
    revalidatePath("/admin");
  }

  async function setUserStatus(formData: FormData) {
    "use server";
    const userId = String(formData.get("userId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!userId) return;
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) return;
    await prisma.user.update({ where: { id: userId }, data: { status: status as UserStatus } });
    revalidatePath("/admin");
  }

  async function setUserVerification(formData: FormData) {
    "use server";
    const userId = String(formData.get("userId") ?? "");
    const field = String(formData.get("field") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!userId) return;
    if (!['idVerificationStatus', 'driversLicenseStatus'].includes(field)) return;
    if (!['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'].includes(status)) return;
    const nextStatus = status as VerificationStatus;
    await prisma.user.update({
      where: { id: userId },
      data: field === "idVerificationStatus" ? { idVerificationStatus: nextStatus } : { driversLicenseStatus: nextStatus },
    });
    revalidatePath("/admin");
  }

  async function markManualBookingPaid(formData: FormData) {
    "use server";
    const bookingId = String(formData.get("bookingId") ?? "");
    if (!bookingId) return;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, stripeCheckoutSessionId: true },
    });

    // Only allow confirming manual (non-Stripe) pending bookings.
    if (!booking) return;
    if (booking.status !== "PENDING_PAYMENT") return;
    if (booking.stripeCheckoutSessionId) return;

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED", paidAt: new Date() },
    });

    revalidatePath("/admin");
  }

  async function setSupportTicketStatus(formData: FormData) {
    "use server";
    const ticketId = String(formData.get("ticketId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!ticketId) return;
    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) return;
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: status as SupportTicketStatus } });
    revalidatePath("/admin");
  }

  async function setIncidentStatus(formData: FormData) {
    "use server";
    const incidentId = String(formData.get("incidentId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!incidentId) return;
    if (!['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'].includes(status)) return;
    await prisma.incidentReport.update({ where: { id: incidentId }, data: { status: status as IncidentStatus } });
    revalidatePath("/admin");
  }

  async function createHostPayout(formData: FormData) {
    "use server";
    await requireRole("ADMIN");

    const hostId = String(formData.get("hostId") ?? "").trim();
    const amount = Number(String(formData.get("amount") ?? "").trim());
    const currency = String(formData.get("currency") ?? "ZAR").trim().toUpperCase().slice(0, 3) || "ZAR";
    const periodStartStr = String(formData.get("periodStart") ?? "").trim();
    const periodEndStr = String(formData.get("periodEnd") ?? "").trim();

    if (!hostId) return;
    if (!Number.isFinite(amount) || amount <= 0) return;

    const amountCents = Math.round(amount * 100);
    const periodStart = periodStartStr ? new Date(periodStartStr) : null;
    const periodEnd = periodEndStr ? new Date(periodEndStr) : null;

    await prisma.hostPayout.create({
      data: {
        hostId,
        amountCents,
        currency,
        status: "PENDING",
        periodStart: periodStart && !Number.isNaN(periodStart.getTime()) ? periodStart : null,
        periodEnd: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd : null,
      },
    });

    revalidatePath("/admin");
  }

  async function setPayoutStatus(formData: FormData) {
    "use server";
    await requireRole("ADMIN");

    const payoutId = String(formData.get("payoutId") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    if (!payoutId) return;
    if (!['PENDING', 'PAID', 'FAILED'].includes(status)) return;

    await prisma.hostPayout.update({
      where: { id: payoutId },
      data: { status: status as PayoutStatus },
    });
    revalidatePath("/admin");
  }

  return (
    <main className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="text-sm text-foreground/60">Operations, finance, trust & safety, and support.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Platform overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total users</CardTitle>
              <CardDescription>Hosts + renters + admins.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{totalUsers}</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total cars listed</CardTitle>
              <CardDescription>All vehicle listings.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{totalCars}</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total bookings</CardTitle>
              <CardDescription>All-time.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{totalBookingsAll}</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active rentals now</CardTitle>
              <CardDescription>Confirmed, currently in-range.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{activeRentalsNow}</div>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Bookings (daily)</CardTitle>
              <CardDescription>Last 24 hours.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{bookingsDaily}</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bookings (weekly)</CardTitle>
              <CardDescription>Last 7 days.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{bookingsWeekly}</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bookings (monthly)</CardTitle>
              <CardDescription>Last 30 days.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{bookingsMonthly}</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue overview</CardTitle>
              <CardDescription>Gross confirmed bookings.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6">
              <div className="text-2xl font-semibold">{((grossRevenue._sum.totalCents ?? 0) / 100).toFixed(0)}</div>
              <div className="mt-1 text-sm text-foreground/60">Total across all currencies; commission tracking not configured</div>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Cancellations</CardTitle>
              <CardDescription>All-time cancelled bookings.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{cancellations}</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Disputes & incidents</CardTitle>
              <CardDescription>Open/in-review incidents.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{openIncidentsCount}</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Support tickets</CardTitle>
              <CardDescription>Open/in-progress.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{openTicketsCount}</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Finance</CardTitle>
              <CardDescription>Refunds/chargebacks.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-sm text-foreground/60">Not enabled yet</div>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vehicle management</h2>
        <div className="text-sm text-foreground/60">
          Pending approvals and listing status management.
        </div>
        {pendingListings.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No pending listings</CardTitle>
              <CardDescription>New host listings will appear here until approved.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-2">
            {pendingListings.map((l) => (
              <Card key={l.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle>{l.title}</CardTitle>
                      <CardDescription>
                        {l.city} • Host: {l.host.email}
                      </CardDescription>
                      <div className="pt-1">
                        <Badge variant={badgeVariantForListingStatus(l.status)}>{l.status}</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <form action={approveListing}>
                        <input type="hidden" name="listingId" value={l.id} />
                        <Button type="submit">Approve</Button>
                      </form>

                      <form action={setListingStatus} className="flex items-center gap-2">
                        <input type="hidden" name="listingId" value={l.id} />
                        <select
                          name="status"
                          defaultValue={l.status}
                          className="rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="PAUSED">PAUSED</option>
                          <option value="DRAFT">DRAFT</option>
                        </select>
                        <Button type="submit" variant="secondary">
                          Update
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All vehicles</CardTitle>
            <CardDescription>Latest listings across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">City</th>
                    <th className="px-3 py-2">Host</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Approved</th>
                    <th className="px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {listingsAll.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link className="underline" href={`/listings/${l.id}`}>
                          {l.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{l.city}</td>
                      <td className="px-3 py-2">{l.host.email}</td>
                      <td className="px-3 py-2">
                        <Badge variant={badgeVariantForListingStatus(l.status)}>{l.status}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={l.isApproved ? "success" : "warning"}>
                          {l.isApproved ? "Yes" : "No"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{iso(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">User management</h2>
        <form className="flex flex-wrap items-center gap-2" action="/admin" method="get">
          <Input name="q" defaultValue={q} placeholder="Search by email" className="max-w-sm" />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">ID verify</th>
                <th className="px-3 py-2">License</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Docs</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">
                    <Badge variant={badgeVariantForRole(u.role)}>{u.role}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={badgeVariantForUserStatus(u.status)}>{u.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={badgeVariantForVerificationStatus(u.idVerificationStatus)}>{u.idVerificationStatus}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={badgeVariantForVerificationStatus(u.driversLicenseStatus)}>{u.driversLicenseStatus}</Badge>
                  </td>
                  <td className="px-3 py-2">{u.createdAt.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/admin/user-documents/profile?email=${encodeURIComponent(u.email)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-foreground/80 underline decoration-border hover:text-foreground"
                      >
                        Profile
                      </a>
                      <a
                        href={`/api/admin/user-documents/id?email=${encodeURIComponent(u.email)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-foreground/80 underline decoration-border hover:text-foreground"
                      >
                        ID
                      </a>
                      <a
                        href={`/api/admin/user-documents/license?email=${encodeURIComponent(u.email)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-foreground/80 underline decoration-border hover:text-foreground"
                      >
                        DL
                      </a>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={setUserRole} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="role"
                          defaultValue={u.role}
                          className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                        >
                          <option value="RENTER">RENTER</option>
                          <option value="HOST">HOST</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        <Button type="submit" variant="secondary">Role</Button>
                      </form>

                      <form action={setUserStatus} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="status"
                          defaultValue={u.status}
                          className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                        </select>
                        <Button type="submit" variant="secondary">Status</Button>
                      </form>

                      <form action={setUserVerification} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="field" value="idVerificationStatus" />
                        <select
                          name="status"
                          defaultValue={u.idVerificationStatus}
                          className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                        >
                          <option value="UNVERIFIED">UNVERIFIED</option>
                          <option value="PENDING">PENDING</option>
                          <option value="VERIFIED">VERIFIED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                        <Button type="submit" variant="secondary">ID</Button>
                      </form>

                      <form action={setUserVerification} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="field" value="driversLicenseStatus" />
                        <select
                          name="status"
                          defaultValue={u.driversLicenseStatus}
                          className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                        >
                          <option value="UNVERIFIED">UNVERIFIED</option>
                          <option value="PENDING">PENDING</option>
                          <option value="VERIFIED">VERIFIED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                        <Button type="submit" variant="secondary">DL</Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Booking & operations</h2>

        <form className="flex flex-wrap items-center gap-2" action="/admin" method="get">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <select
            name="bookingStatus"
            defaultValue={bookingStatus ?? ""}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            <option value="">All statuses</option>
            <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Ongoing trips</CardTitle>
              <CardDescription>Confirmed and currently active.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-2xl font-semibold">{activeRentalsNow}</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Overdue returns</CardTitle>
              <CardDescription>Not tracked (no return check-in).</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-sm text-foreground/60">Not enabled yet</div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Damage claims</CardTitle>
              <CardDescription>Use incident reports.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 text-sm text-foreground/60">See Risk, Trust & Safety</div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All bookings</CardTitle>
            <CardDescription>Latest bookings with renter/host context.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2">Listing</th>
                    <th className="px-3 py-2">Host</th>
                    <th className="px-3 py-2">Renter</th>
                    <th className="px-3 py-2">Dates</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingsOps.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link className="underline" href={`/listings/${b.listing.id}`}>
                          {b.listing.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{b.listing.host.email}</td>
                      <td className="px-3 py-2">{b.renter.email}</td>
                      <td className="px-3 py-2">
                        {iso(b.startDate)} → {iso(b.endDate)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={b.stripeCheckoutSessionId ? "info" : "warning"}>
                          {b.stripeCheckoutSessionId ? "Stripe" : "EFT"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {(b.totalCents / 100).toFixed(0)} {b.currency}
                      </td>
                      <td className="px-3 py-2">{iso(b.createdAt)}</td>
                      <td className="px-3 py-2">
                        {!b.stripeCheckoutSessionId && b.status === "PENDING_PAYMENT" ? (
                          <form action={markManualBookingPaid}>
                            <input type="hidden" name="bookingId" value={b.id} />
                            <Button type="submit" variant="secondary">Mark paid</Button>
                          </form>
                        ) : (
                          <span className="text-sm text-foreground/60">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2">Listing</th>
                <th className="px-3 py-2">Renter</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-3 py-2">{b.listing.title}</td>
                  <td className="px-3 py-2">{b.renter.email}</td>
                  <td className="px-3 py-2">
                    <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {(b.totalCents / 100).toFixed(0)} {b.currency}
                  </td>
                  <td className="px-3 py-2">{b.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payments & financials</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending payouts</CardTitle>
              <CardDescription>Recorded host payout items.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{((pendingPayoutAgg._sum.amountCents ?? 0) / 100).toFixed(0)}</div>
              <div className="mt-1 text-sm text-foreground/60">{pendingPayoutAgg._count._all} pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Paid (30 days)</CardTitle>
              <CardDescription>Payouts marked paid.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{((paidPayoutAgg._sum.amountCents ?? 0) / 100).toFixed(0)}</div>
              <div className="mt-1 text-sm text-foreground/60">{paidPayoutAgg._count._all} paid</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Refunds</CardTitle>
              <CardDescription>Not tracked yet.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-foreground/60">Not enabled</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Chargebacks</CardTitle>
              <CardDescription>Not tracked yet.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-foreground/60">Not enabled</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create host payout</CardTitle>
            <CardDescription>Creates a payout record (does not move money automatically).</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createHostPayout} className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Host</label>
                <select
                  name="hostId"
                  defaultValue=""
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                  required
                >
                  <option value="" disabled>
                    Select host
                  </option>
                  {hostsForPayout.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input className="mt-1" name="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
              </div>

              <div>
                <label className="text-sm font-medium">Currency</label>
                <select
                  name="currency"
                  defaultValue="ZAR"
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                >
                  <option value="ZAR">ZAR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Period start</label>
                <Input className="mt-1" name="periodStart" type="date" />
              </div>
              <div>
                <label className="text-sm font-medium">Period end</label>
                <Input className="mt-1" name="periodEnd" type="date" />
              </div>

              <div className="md:col-span-4">
                <Button type="submit">Create payout</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Host payouts</CardTitle>
            <CardDescription>Latest payout records and status updates.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPayouts.length === 0 ? (
              <div className="text-sm text-foreground/60">No payouts yet.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2">Host</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayouts.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-2">{p.host.email}</td>
                        <td className="px-3 py-2">{(p.amountCents / 100).toFixed(0)} {p.currency}</td>
                        <td className="px-3 py-2"><Badge variant={badgeVariantForPayoutStatus(p.status)}>{p.status}</Badge></td>
                        <td className="px-3 py-2">
                          {p.periodStart ? iso(p.periodStart) : "-"} → {p.periodEnd ? iso(p.periodEnd) : "-"}
                        </td>
                        <td className="px-3 py-2">{iso(p.createdAt)}</td>
                        <td className="px-3 py-2">
                          <form action={setPayoutStatus} className="flex items-center gap-2">
                            <input type="hidden" name="payoutId" value={p.id} />
                            <select
                              name="status"
                              defaultValue={p.status}
                              className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                            >
                              <option value="PENDING">PENDING</option>
                              <option value="PAID">PAID</option>
                              <option value="FAILED">FAILED</option>
                            </select>
                            <Button type="submit" variant="secondary">Save</Button>
                          </form>
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
        <h2 className="text-lg font-semibold">Risk, trust & safety</h2>

        <form className="flex flex-wrap items-center gap-2" action="/admin" method="get">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <select
            name="incidentStatus"
            defaultValue={incidentStatus ?? ""}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            <option value="">All statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>

        <Card>
          <CardHeader>
            <CardTitle>Incidents</CardTitle>
            <CardDescription>Accidents, damage, fraud, and safety events.</CardDescription>
          </CardHeader>
          <CardContent>
            {incidentReports.length === 0 ? (
              <div className="text-sm text-foreground/60">No incidents found.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Reporter</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidentReports.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <Badge variant="info">{r.type as IncidentType}</Badge>
                        </td>
                        <td className="px-3 py-2">{r.title}</td>
                        <td className="px-3 py-2">{r.user.email}</td>
                        <td className="px-3 py-2">
                          <Badge variant={badgeVariantForIncidentStatus(r.status)}>{r.status}</Badge>
                        </td>
                        <td className="px-3 py-2">{iso(r.createdAt)}</td>
                        <td className="px-3 py-2">
                          <form action={setIncidentStatus} className="flex items-center gap-2">
                            <input type="hidden" name="incidentId" value={r.id} />
                            <select
                              name="status"
                              defaultValue={r.status}
                              className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                            >
                              <option value="OPEN">OPEN</option>
                              <option value="IN_REVIEW">IN_REVIEW</option>
                              <option value="RESOLVED">RESOLVED</option>
                              <option value="CLOSED">CLOSED</option>
                            </select>
                            <Button type="submit" variant="secondary">Save</Button>
                          </form>
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
        <h2 className="text-lg font-semibold">Support tools</h2>

        <form className="flex flex-wrap items-center gap-2" action="/admin" method="get">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <select
            name="ticketStatus"
            defaultValue={ticketStatus ?? ""}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            <option value="">All statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>

        <Card>
          <CardHeader>
            <CardTitle>Support tickets</CardTitle>
            <CardDescription>Ticket dashboard and resolution workflow.</CardDescription>
          </CardHeader>
          <CardContent>
            {supportTickets.length === 0 ? (
              <div className="text-sm text-foreground/60">No tickets found.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supportTickets.map((t) => (
                      <tr key={t.id} className="border-t border-border">
                        <td className="px-3 py-2">{t.subject}</td>
                        <td className="px-3 py-2">{t.user.email}</td>
                        <td className="px-3 py-2"><Badge variant={badgeVariantForRole(t.user.role)}>{t.user.role}</Badge></td>
                        <td className="px-3 py-2"><Badge variant={badgeVariantForSupportTicketStatus(t.status)}>{t.status}</Badge></td>
                        <td className="px-3 py-2">{iso(t.createdAt)}</td>
                        <td className="px-3 py-2">
                          <form action={setSupportTicketStatus} className="flex items-center gap-2">
                            <input type="hidden" name="ticketId" value={t.id} />
                            <select
                              name="status"
                              defaultValue={t.status}
                              className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                            >
                              <option value="OPEN">OPEN</option>
                              <option value="IN_PROGRESS">IN_PROGRESS</option>
                              <option value="RESOLVED">RESOLVED</option>
                              <option value="CLOSED">CLOSED</option>
                            </select>
                            <Button type="submit" variant="secondary">Save</Button>
                          </form>
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
    </main>
  );
}
