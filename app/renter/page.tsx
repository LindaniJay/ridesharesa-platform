import Link from "next/link";

export const dynamic = "force-dynamic";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";
import DocumentsUploadForm from "@/app/components/DocumentsUploadForm.client";
import {
  badgeVariantForBookingStatus,
  badgeVariantForSupportTicketStatus,
  badgeVariantForVerificationStatus,
} from "@/app/lib/badgeVariants";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

type RenterSection = "bookings" | "payments" | "profile" | "support" | "reviews";

function parseSection(value: unknown): RenterSection | null {
  const v = String(value ?? "").trim();
  const allowed: readonly RenterSection[] = ["bookings", "payments", "profile", "support", "reviews"];
  return allowed.includes(v as RenterSection) ? (v as RenterSection) : null;
}

function renterHref(params: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/renter?${qs}` : "/renter";
}

function SidebarLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-lg border border-accent/25 bg-accent-soft px-3 py-2 text-sm font-medium text-foreground"
          : "rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

export default async function RenterDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string }>;
}) {
  const { dbUser, supabaseUser } = await requireRole("RENTER");
  const renterId = dbUser.id;

  const resolved = searchParams ? await searchParams : undefined;
  const section = parseSection(resolved?.section) ?? "bookings";

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

  const [upcoming, ongoing, past, supportTickets] = await Promise.all([
    prisma.booking.findMany({
      where: {
        renterId,
        status: { in: ["CONFIRMED", "PENDING_PAYMENT", "PENDING_APPROVAL"] },
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
        status: { in: ["CONFIRMED", "PENDING_APPROVAL"] },
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
        status: { in: ["CONFIRMED", "PENDING_APPROVAL", "CANCELLED"] },
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
    <main className="grid gap-4 sm:gap-6 lg:grid-cols-[250px_1fr]">
      <aside className="space-y-3 sm:space-y-4 lg:sticky lg:top-6 lg:self-start">
        {/* Profile Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {profileImageSignedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL
                <img
                  src={profileImageSignedUrl}
                  alt="Profile"
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold">{dbUser.name || 'Renter'}</h1>
                <p className="text-xs text-muted-foreground truncate">{dbUser.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dashboard</CardTitle>
            <CardDescription>Navigate your account</CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            <nav className="flex flex-col gap-1">
              {(
                [
                  { key: "bookings", label: "My Bookings", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
                  { key: "payments", label: "Payments", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
                  { key: "profile", label: "My Profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                  { key: "support", label: "Support", icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" },
                  { key: "reviews", label: "Reviews", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
                ] as const
              ).map((s) => (
                <Link
                  key={s.key}
                  href={renterHref({ section: s.key })}
                  className={
                    section === s.key
                      ? "flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium"
                      : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  }
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                  </svg>
                  {s.label}
                </Link>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Upcoming</span>
              <span className="text-lg font-bold">{upcoming.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active</span>
              <span className="text-lg font-bold">{ongoing.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Completed</span>
              <span className="text-lg font-bold">{past.length}</span>
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="space-y-6 sm:space-y-8">
        {section === "bookings" ? (
          <section className="space-y-2 sm:space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold">Bookings overview</h2>

            <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming</CardTitle>
              <CardDescription>Bookings that haven’t started yet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? (
                <div className="text-sm text-foreground/60">No upcoming bookings.</div>
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
              <CardDescription>Bookings currently in progress.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ongoing.length === 0 ? (
                <div className="text-sm text-foreground/60">No active booking right now.</div>
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
              <CardDescription>Completed or cancelled bookings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {past.length === 0 ? (
                <div className="text-sm text-foreground/60">No past bookings.</div>
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
        ) : null}

        {section === "payments" ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Payments & wallet</h2>
            <Card>
              <CardHeader>
                <CardTitle>Payment history</CardTitle>
                <CardDescription>Invoices per booking (from booking totals).</CardDescription>
              </CardHeader>
              <CardContent>
                {past.length === 0 ? (
                  <div className="text-sm text-foreground/60">No payment history yet.</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="min-w-[640px] w-full text-left text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2">Booking</th>
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
        ) : null}

        {section === "profile" ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Profile & verification</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Profile creation</CardTitle>
                  <CardDescription>Enter your details and upload verification images.</CardDescription>
                </CardHeader>
                <CardContent>
                  <DocumentsUploadForm successHref="/renter" nextHref="/renter" />
                  {profileImageSignedUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profileImageSignedUrl}
                        alt="Profile"
                        className="mt-4 h-24 w-24 rounded-full border object-cover"
                      />
                    </>
                  ) : (
                    <div className="mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-muted">No photo</div>
                  )}
                </CardContent>
              </Card>
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
        ) : null}

        {section === "support" ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Support & safety</h2>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Contact support</CardTitle>
                  <CardDescription>Create a ticket for issues during a booking.</CardDescription>
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
        ) : null}

        {section === "reviews" ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Ratings & reviews</h2>
            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
                <CardDescription>Review flows can be enabled per completed booking.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-foreground/60">Reviews are not enabled yet in this build.</div>
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}
