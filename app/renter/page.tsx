import Link from "next/link";
import { revalidatePath } from "next/cache";

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
          ? "flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium"
          : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
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

  const [upcoming, ongoing, past, supportTickets, authoredReviews] = await Promise.all([
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
        reviews: {
          where: { authorId: renterId },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.supportTicket.findMany({
      where: { userId: renterId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, subject: true, status: true, createdAt: true },
    }),
    prisma.review.findMany({
      where: { authorId: renterId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        targetUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        booking: {
          select: {
            id: true,
            listing: {
              select: {
                title: true,
                city: true,
              },
            },
          },
        },
      },
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

    revalidatePath("/renter");
  }

  async function cancelUpcomingBooking(formData: FormData) {
    "use server";

    const { dbUser } = await requireRole("RENTER");
    const bookingId = String(formData.get("bookingId") ?? "").trim();
    if (!bookingId) return;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        renterId: true,
        status: true,
        endDate: true,
      },
    });

    if (!booking) return;
    if (booking.renterId !== dbUser.id) return;
    if (!["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED"].includes(booking.status)) return;
    if (booking.endDate <= new Date()) return;

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });

    await prisma.bookingMessage.create({
      data: {
        bookingId: booking.id,
        senderId: dbUser.id,
        recipientRole: "HOST",
        body: "BOOKING UPDATE: Renter cancelled this booking.",
      },
    });

    revalidatePath("/renter");
    revalidatePath(`/bookings/${booking.id}`);
  }

  return (
    <main className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
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
                <SidebarLink
                  key={s.key}
                  href={renterHref({ section: s.key })}
                  active={section === s.key}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                  </svg>
                  {s.label}
                </SidebarLink>
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

      <div className="space-y-8">
        {section === "bookings" ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Bookings overview</h2>

            <div className="grid gap-4 lg:grid-cols-3">
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
                    <div key={b.id} className="rounded-xl border border-border bg-background p-3 text-sm transition-colors hover:bg-muted/40">
                      <Link href={`/bookings/${b.id}`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium underline decoration-dotted underline-offset-4">{b.listing.title}</div>
                            <div className="text-foreground/60">{b.listing.city}</div>
                          </div>
                          <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                        </div>
                        <div className="mt-2 text-foreground/70">
                          {iso(b.startDate)} → {iso(b.endDate)}
                        </div>
                      </Link>
                      <div className="mt-3 space-y-2">
                        <div className="text-xs text-foreground/70">Workflow: open booking details, complete payment if pending, then chat with host/admin for updates.</div>
                        <div className="flex flex-wrap gap-2">
                          <Link className="inline-flex rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted" href={`/bookings/${b.id}`}>
                            Open booking
                          </Link>
                          {["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED"].includes(b.status) ? (
                            <form action={cancelUpcomingBooking}>
                              <input type="hidden" name="bookingId" value={b.id} />
                              <Button type="submit" variant="secondary" className="h-7 px-2.5 text-xs">
                                Cancel booking
                              </Button>
                            </form>
                          ) : null}
                        </div>
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
                    <div key={b.id} className="rounded-xl border border-border bg-background p-3 text-sm transition-colors hover:bg-muted/40">
                      <Link href={`/bookings/${b.id}`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium underline decoration-dotted underline-offset-4">{b.listing.title}</div>
                            <div className="text-foreground/60">{b.listing.city}</div>
                          </div>
                          <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                        </div>
                        <div className="mt-2 text-foreground/70">
                          {iso(b.startDate)} → {iso(b.endDate)}
                        </div>
                      </Link>
                      <div className="mt-3 space-y-2">
                        <div className="text-xs text-foreground/70">Workflow: open booking, upload handover/return photos, request extension or return, and keep messaging in chat.</div>
                        <div className="flex flex-wrap gap-2">
                          <Link className="inline-flex rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted" href={`/bookings/${b.id}`}>
                            Manage trip
                          </Link>
                          {["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED"].includes(b.status) ? (
                            <form action={cancelUpcomingBooking}>
                              <input type="hidden" name="bookingId" value={b.id} />
                              <Button type="submit" variant="secondary" className="h-7 px-2.5 text-xs">
                                Cancel booking
                              </Button>
                            </form>
                          ) : null}
                        </div>
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
                    <div key={b.id} className="rounded-xl border border-border bg-background p-3 text-sm transition-colors hover:bg-muted/40">
                      <Link href={`/bookings/${b.id}`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium underline decoration-dotted underline-offset-4">{b.listing.title}</div>
                            <div className="text-foreground/60">{b.listing.city}</div>
                          </div>
                          <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                        </div>
                        <div className="mt-2 text-foreground/70">
                          {iso(b.startDate)} → {iso(b.endDate)}
                        </div>
                      </Link>
                      <div className="mt-3 space-y-2">
                        <div className="text-xs text-foreground/70">Workflow: view receipt/history, review trip evidence, and open support ticket if there is a dispute.</div>
                        <div className="flex flex-wrap gap-2">
                          <Link className="inline-flex rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted" href={`/bookings/${b.id}`}>
                            View summary
                          </Link>
                          {b.status === "CONFIRMED" && b.reviews.length === 0 ? (
                            <Link className="inline-flex rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted" href={`/bookings/${b.id}`}>
                              Leave review
                            </Link>
                          ) : null}
                          <Link className="inline-flex rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted" href={renterHref({ section: "support" })}>
                            Open support
                          </Link>
                        </div>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Profile snapshot</CardTitle>
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
                    <div>{dbUser.name || "Renter"}</div>
                    <div>{dbUser.email}</div>
                  </div>
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
                <CardDescription>Keep your verification pack current to avoid account restrictions.</CardDescription>
              </CardHeader>
              <CardContent>
                <form>
                  <DocumentsUploadForm successHref="/renter" nextHref="/renter" />
                </form>
              </CardContent>
            </Card>
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
                <CardDescription>Reviews you have left after completed trips.</CardDescription>
              </CardHeader>
              <CardContent>
                {past.some((b) => b.status === "CONFIRMED" && b.reviews.length === 0) ? (
                  <div className="mb-4 space-y-2">
                    <div className="text-sm font-medium">Trips awaiting your review</div>
                    <div className="space-y-2">
                      {past
                        .filter((b) => b.status === "CONFIRMED" && b.reviews.length === 0)
                        .map((b) => (
                          <div key={`pending-review-${b.id}`} className="rounded-xl border border-border bg-background p-3 text-sm">
                            <div className="font-medium">{b.listing.title}</div>
                            <div className="mt-1 text-xs text-foreground/60">{b.listing.city} · {iso(b.startDate)} → {iso(b.endDate)}</div>
                            <div className="mt-2">
                              <Link className="underline" href={`/bookings/${b.id}`}>
                                Leave review
                              </Link>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}

                {authoredReviews.length === 0 ? (
                  <div className="space-y-2 text-sm text-foreground/60">
                    <div>No reviews submitted yet.</div>
                    <div>
                      Open a completed booking from <Link className="underline" href={renterHref({ section: "bookings" })}>Bookings</Link> to leave a review.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {authoredReviews.map((r) => (
                      <div key={r.id} className="rounded-xl border border-border bg-background p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">{r.booking?.listing.title ?? "Booking review"}</div>
                          <div className="text-xs text-foreground/70">Rating: {r.rating}/5</div>
                        </div>
                        <div className="mt-1 text-xs text-foreground/60">
                          Host: {r.targetUser.name || r.targetUser.email}
                          {r.booking?.listing.city ? ` · ${r.booking.listing.city}` : ""}
                        </div>
                        <div className="mt-1 text-xs text-foreground/60">Submitted {iso(r.createdAt)}</div>
                        {r.comment ? <div className="mt-2 text-foreground/70">{r.comment}</div> : null}
                        {r.booking?.id ? (
                          <div className="mt-2">
                            <Link className="underline" href={`/bookings/${r.booking.id}`}>
                              Open booking
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}
