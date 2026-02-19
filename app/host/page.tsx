import Link from "next/link";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
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
  let profileImageSignedUrl: string | null = null;
  if (profileImagePath) {
    const { data } = await supabaseAdmin().storage.from(userDocsBucket).createSignedUrl(profileImagePath, 60 * 10);
    if (data?.signedUrl) profileImageSignedUrl = data.signedUrl;
  }

  const now = new Date();

  const [
    listings,
    upcomingBookings,
    activeBookings,
    pastBookings,
    supportTickets,
    confirmedTotals,
    pendingPayouts,
    paidPayouts,
    recentPayouts,
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
        status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
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
        renter: { select: { email: true } },
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
        renter: { select: { email: true } },
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
        renter: { select: { email: true } },
        listing: { select: { title: true, city: true } },
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
  ]);

  const totalEarningsCents = confirmedTotals._sum.totalCents ?? 0;
  const confirmedTrips = confirmedTotals._count._all;
  const pendingPayoutCents = pendingPayouts._sum.amountCents ?? 0;
  const pendingPayoutCount = pendingPayouts._count._all;
  const paidPayoutCents = paidPayouts._sum.amountCents ?? 0;
  const paidPayoutCount = paidPayouts._count._all;

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
  }

  return (
    <main className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Host dashboard</h1>
          <p className="text-sm text-foreground/60">Earnings, bookings, vehicles, and support.</p>
        </div>
        <Link href="/host/listings/new">
          <Button>New vehicle</Button>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Business overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle>Total earnings</CardTitle>
              <CardDescription>Confirmed bookings total.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{(totalEarningsCents / 100).toFixed(0)} ZAR</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming payouts</CardTitle>
              <CardDescription>Recorded payout items (if used).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{(pendingPayoutCents / 100).toFixed(0)} ZAR</div>
              <div className="mt-1 text-sm text-foreground/60">{pendingPayoutCount} pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Paid out</CardTitle>
              <CardDescription>Total payouts marked paid.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{(paidPayoutCents / 100).toFixed(0)} ZAR</div>
              <div className="mt-1 text-sm text-foreground/60">{paidPayoutCount} paid</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bookings in progress</CardTitle>
              <CardDescription>Active rentals right now.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{activeBookings.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Booking history</CardTitle>
              <CardDescription>Confirmed bookings completed.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{confirmedTrips}</div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Profile & verification</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Host profile</CardTitle>
              <CardDescription>Business details and verification images.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action="/api/account/documents" method="post" encType="multipart/form-data" className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-sm">Full name</div>
                  <Input name="name" defaultValue={dbUser.name || ""} required />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">Phone number</div>
                  <Input name="phone" type="tel" required placeholder="+27 123 456 7890" />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">Date of birth</div>
                  <Input name="dob" type="date" required />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">Address</div>
                  <Input name="address" required placeholder="Street, City, Country" />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">ID number</div>
                  <Input name="idNumber" required placeholder="ID or passport number" />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">Profile photo</div>
                  <Input name="profilePhoto" type="file" accept="image/*" required />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">ID document</div>
                  <Input name="idDocument" type="file" accept="image/*" required />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">Drivers license</div>
                  <Input name="driversLicense" type="file" accept="image/*" required />
                </label>
                <Button type="submit" className="w-full">Save profile</Button>
              </form>
              {profileImageSignedUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profileImageSignedUrl}
                    alt="Profile"
                    className="w-24 h-24 rounded-full mt-4 object-cover border"
                  />
                </>
              ) : (
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mt-4">No photo</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Drivers license</CardTitle>
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
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payout history</h2>
        {recentPayouts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No payouts yet</CardTitle>
              <CardDescription>Payout records created by admin will show here.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border shadow-sm">
            <table className="w-full text-left text-sm">
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
                        <div className="text-foreground/60">Renter: {b.renter.email}</div>
                      </div>
                      <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                    </div>
                    <div className="mt-2 text-foreground/70">
                      {iso(b.startDate)} → {iso(b.endDate)}
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
                        <div className="text-foreground/60">Renter: {b.renter.email}</div>
                      </div>
                      <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                    </div>
                    <div className="mt-2 text-foreground/70">
                      {iso(b.startDate)} → {iso(b.endDate)}
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
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
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
            <CardTitle>Insights</CardTitle>
            <CardDescription>Utilization and pricing recommendations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-foreground/60">
              Dynamic pricing, utilization analytics, and tips aren’t enabled yet.
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
