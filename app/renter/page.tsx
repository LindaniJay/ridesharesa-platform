import Link from "next/link";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";
import {
  badgeVariantForBookingStatus,
  badgeVariantForSupportTicketStatus,
  badgeVariantForVerificationStatus,
} from "@/app/lib/badgeVariants";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function RenterDashboardPage() {
  const { dbUser } = await requireRole("RENTER");
  const renterId = dbUser.id;

  const now = new Date();

  const [upcoming, ongoing, past, supportTickets] = await Promise.all([
    prisma.booking.findMany({
      where: {
        renterId,
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
        listing: { select: { id: true, title: true, city: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        renterId,
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
        listing: { select: { id: true, title: true, city: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        renterId,
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
        listing: { select: { id: true, title: true, city: true } },
      },
    }),
    prisma.supportTicket.findMany({
      where: { userId: renterId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, subject: true, status: true, createdAt: true },
    }),
  ]);

  async function createSupportTicket(formData: FormData) {
    "use server";

    const { dbUser } = await requireRole("RENTER");
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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Renter dashboard</h1>
        <p className="text-sm text-foreground/60">Manage your trips, payments, and support.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Trips overview</h2>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming</CardTitle>
              <CardDescription>Trips that haven’t started yet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? (
                <div className="text-sm text-foreground/60">No upcoming trips.</div>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((b) => (
                    <div key={b.id} className="rounded-xl border border-border bg-background p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            <Link className="underline" href={`/bookings/${b.id}`}>
                              {b.listing.title}
                            </Link>
                          </div>
                          <div className="text-foreground/60">{b.listing.city}</div>
                        </div>
                        <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                      </div>
                      <div className="mt-2 text-foreground/70">
                        {iso(b.startDate)} → {iso(b.endDate)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ongoing</CardTitle>
              <CardDescription>Trips currently in progress.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ongoing.length === 0 ? (
                <div className="text-sm text-foreground/60">No active trip right now.</div>
              ) : (
                <div className="space-y-2">
                  {ongoing.map((b) => (
                    <div key={b.id} className="rounded-xl border border-border bg-background p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            <Link className="underline" href={`/bookings/${b.id}`}>
                              {b.listing.title}
                            </Link>
                          </div>
                          <div className="text-foreground/60">{b.listing.city}</div>
                        </div>
                        <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                      </div>
                      <div className="mt-2 text-foreground/70">
                        {iso(b.startDate)} → {iso(b.endDate)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Past</CardTitle>
              <CardDescription>Completed or cancelled trips.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {past.length === 0 ? (
                <div className="text-sm text-foreground/60">No past trips.</div>
              ) : (
                <div className="space-y-2">
                  {past.map((b) => (
                    <div key={b.id} className="rounded-xl border border-border bg-background p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            <Link className="underline" href={`/bookings/${b.id}`}>
                              {b.listing.title}
                            </Link>
                          </div>
                          <div className="text-foreground/60">{b.listing.city}</div>
                        </div>
                        <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                      </div>
                      <div className="mt-2 text-foreground/70">
                        {iso(b.startDate)} → {iso(b.endDate)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-sm">
          <Link className="underline" href="/listings">
            Search cars
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payments & wallet</h2>
        <Card>
          <CardHeader>
            <CardTitle>Payment history</CardTitle>
            <CardDescription>Invoices per trip (from booking totals).</CardDescription>
          </CardHeader>
          <CardContent>
            {past.length === 0 ? (
              <div className="text-sm text-foreground/60">No payment history yet.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2">Trip</th>
                      <th className="px-3 py-2">Dates</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {past.map((b) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <Link className="underline" href={`/bookings/${b.id}`}>
                            {b.listing.title}
                          </Link>
                        </td>
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
        <h2 className="text-lg font-semibold">Profile & verification</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Driver’s license</CardTitle>
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

      <section id="support" className="space-y-3">
        <h2 className="text-lg font-semibold">Support & safety</h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Contact support</CardTitle>
              <CardDescription>Create a ticket for issues during a trip.</CardDescription>
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
              <CardDescription>Recent support requests.</CardDescription>
            </CardHeader>
            <CardContent>
              {supportTickets.length === 0 ? (
                <div className="text-sm text-foreground/60">No tickets yet.</div>
              ) : (
                <div className="space-y-2">
                  {supportTickets.map((t) => (
                    <div key={t.id} className="rounded-xl border border-border bg-background p-3 text-sm">
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
        <h2 className="text-lg font-semibold">Ratings & reviews</h2>
        <Card>
          <CardHeader>
            <CardTitle>Reviews</CardTitle>
            <CardDescription>Review flows can be enabled per completed trip.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-foreground/60">
              Reviews are not enabled yet in this build.
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
