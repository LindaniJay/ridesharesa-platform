import { revalidatePath } from "next/cache";
import Link from "next/link";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import AdminProfilePhotoForm from "@/app/admin/AdminProfilePhotoForm.client";
import AdminPayoutCalculator from "@/app/admin/AdminPayoutCalculator.client";
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
import { cn } from "@/app/lib/cn";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
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

function formatInt(n: number) {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(n);
}

function formatMoneyZar(amountCents: number) {
  const rands = amountCents / 100;
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(
    rands,
  );
}

function pctChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildDailySeries(
  startDay: Date,
  days: number,
  rows: { day: Date; value: number }[],
) {
  const byDay = new Map(rows.map((r) => [dayKey(r.day), r.value] as const));
  const values: number[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    values.push(byDay.get(dayKey(d)) ?? 0);
  }
  return values;
}

function MiniBars({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values);
  const width = 300;
  const height = 64;
  const gap = 2;
  const barCount = values.length;
  const barWidth = Math.max(1, Math.floor((width - gap * (barCount - 1)) / barCount));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-16 w-full text-foreground/20", className)}>
      {values.map((v, i) => {
        const h = Math.max(1, Math.round((v / max) * (height - 6)));
        const x = i * (barWidth + gap);
        const y = height - h;
        return <rect key={i} x={x} y={y} width={barWidth} height={h} fill="currentColor" rx={1} />;
      })}
    </svg>
  );
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseStatus<T extends string>(value: unknown, allowed: readonly T[]) {
  const v = String(value ?? "");
  return allowed.includes(v as T) ? (v as T) : null;
}

type AdminSection =
  | "overview"
  | "settings"
  | "analytics"
  | "vehicles"
  | "users"
  | "bookings"
  | "messages"
  | "payments"
  | "risk"
  | "support";

type UserDocKind = "profile" | "id" | "license";

function parseUserDocKind(value: unknown): UserDocKind | null {
  const v = String(value ?? "").trim();
  return v === "profile" || v === "id" || v === "license" ? v : null;
}

async function getUserDocSignedUrl(params: { userId: string; kind: UserDocKind }) {
  const bucket = process.env.SUPABASE_USER_DOCS_BUCKET || "user-documents";

  const admin = supabaseAdmin();
  const { data, error } = await admin.storage.from(bucket).list(params.userId, { limit: 100, offset: 0 });
  if (error) {
    return {
      ok: false as const,
      error: error.message,
      bucket,
    };
  }

  const objects = data ?? [];
  const match = objects.find((o) => typeof o.name === "string" && o.name.startsWith(`${params.kind}.`));
  if (!match) {
    return {
      ok: false as const,
      error: "Document not found (user has not uploaded it yet)",
      bucket,
    };
  }

  const path = `${params.userId}/${match.name}`;
  const { data: signedData, error: signedError } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 5);
  if (signedError || !signedData?.signedUrl) {
    return {
      ok: false as const,
      error:
        signedError?.message ||
        `Could not create signed URL (ensure bucket "${bucket}" exists and SUPABASE_SERVICE_ROLE_KEY is set).`,
      bucket,
      path,
    };
  }

  return {
    ok: true as const,
    bucket,
    path,
    signedUrl: signedData.signedUrl,
  };
}

function parseSection(value: unknown): AdminSection | null {
  const v = String(value ?? "").trim();
  const allowed: readonly AdminSection[] = [
    "overview",
    "settings",
    "analytics",
    "vehicles",
    "users",
    "bookings",
    "messages",
    "payments",
    "risk",
    "support",
  ];
  return allowed.includes(v as AdminSection) ? (v as AdminSection) : null;
}

function adminHref(params: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/admin?${qs}` : "/admin";
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    section?: string;
    q?: string;
    bookingStatus?: string;
    ticketStatus?: string;
    incidentStatus?: string;
    userId?: string;
    doc?: string;
  }>;
}) {
  const { dbUser: viewerDbUser, supabaseUser: viewerSupabaseUser } = await requireRole("ADMIN");

  const resolved = searchParams ? await searchParams : undefined;
  const q = (resolved?.q ?? "").trim();
  const section = parseSection(resolved?.section) ?? "overview";
  const selectedUserId = (resolved?.userId ?? "").trim() || null;
  const selectedDocKind = parseUserDocKind(resolved?.doc);
  const bookingStatus = parseStatus<BookingStatus>(resolved?.bookingStatus, [
    "PENDING_PAYMENT",
    "PENDING_APPROVAL",
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
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const trendStart = new Date(monthAgo);
  trendStart.setHours(0, 0, 0, 0);

  const userDocsBucket = process.env.SUPABASE_USER_DOCS_BUCKET || "user-documents";
  const viewerProfileImagePath =
    typeof viewerSupabaseUser.user_metadata?.profileImagePath === "string"
      ? viewerSupabaseUser.user_metadata.profileImagePath
      : null;
  let viewerProfileImageSignedUrl: string | null = null;
  if (viewerProfileImagePath) {
    const { data } = await supabaseAdmin().storage.from(userDocsBucket).createSignedUrl(viewerProfileImagePath, 60 * 10);
    if (data?.signedUrl) viewerProfileImageSignedUrl = data.signedUrl;
  }

  const viewerName =
    (typeof viewerSupabaseUser.user_metadata?.name === "string" && viewerSupabaseUser.user_metadata.name.trim()) ||
    viewerDbUser.name ||
    "";

  const viewerSurname =
    (typeof viewerSupabaseUser.user_metadata?.surname === "string" && viewerSupabaseUser.user_metadata.surname.trim()) ||
    "";

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
    pendingEftBookings,
    supportTickets,
    incidentReports,
    hostsForPayout,
    recentPayouts,
    pendingPayoutAgg,
    paidPayoutAgg,
    bookingsTrendRows,
    revenueTrendRows,
    signupsTrendRows,
    topCitiesRows,
    bookingsPrev30,
    revenuePrev30Agg,
    signupsPrev30,
    revenue30Agg,
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
            role: { not: "ADMIN" },
          }
        : { role: { not: "ADMIN" } },
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
        paidAt: true,
        startDate: true,
        endDate: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        renter: { select: { email: true } },
        listing: { select: { id: true, title: true, city: true, host: { select: { email: true } } } },
      },
    }),
    prisma.booking.findMany({
      where: { status: "PENDING_PAYMENT", stripeCheckoutSessionId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        renter: { select: { email: true } },
        listing: { select: { title: true, host: { select: { email: true } } } },
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
        details: true,
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

    prisma.$queryRaw<{ day: Date; bookings: number }[]>`
      select
        date_trunc('day', "createdAt") as day,
        count(*)::int as bookings
      from "Booking"
      where "createdAt" >= ${trendStart}
      group by 1
      order by 1
    `,
    prisma.$queryRaw<{ day: Date; revenueCents: number }[]>`
      select
        date_trunc('day', "createdAt") as day,
        coalesce(sum("totalCents"), 0)::int as "revenueCents"
      from "Booking"
      where "createdAt" >= ${trendStart}
        and status = 'CONFIRMED'
      group by 1
      order by 1
    `,
    prisma.$queryRaw<{ day: Date; signups: number }[]>`
      select
        date_trunc('day', "createdAt") as day,
        count(*)::int as signups
      from "User"
      where "createdAt" >= ${trendStart}
      group by 1
      order by 1
    `,
    prisma.$queryRaw<{ city: string; bookings: number; revenueCents: number }[]>`
      select
        l.city as city,
        count(*)::int as bookings,
        coalesce(sum(b."totalCents"), 0)::int as "revenueCents"
      from "Booking" b
      join "Listing" l on l.id = b."listingId"
      where b."createdAt" >= ${trendStart}
        and b.status = 'CONFIRMED'
      group by 1
      order by bookings desc, "revenueCents" desc
      limit 8
    `,

    prisma.booking.count({ where: { createdAt: { gte: twoMonthsAgo, lt: monthAgo } } }),
    prisma.booking.aggregate({
      where: { status: "CONFIRMED", createdAt: { gte: twoMonthsAgo, lt: monthAgo } },
      _sum: { totalCents: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: twoMonthsAgo, lt: monthAgo } } }),
    prisma.booking.aggregate({
      where: { status: "CONFIRMED", createdAt: { gte: monthAgo } },
      _sum: { totalCents: true },
    }),
  ]);

  const selectedUser = selectedUserId
    ? await prisma.user.findUnique({
        where: { id: selectedUserId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          idVerificationStatus: true,
          driversLicenseStatus: true,
          createdAt: true,
        },
      })
    : null;

  const selectedUserAllowed = selectedUser ? selectedUser.role !== "ADMIN" : true;

  let selectedDocPreview:
    | {
        ok: true;
        signedUrl: string;
        bucket: string;
        path: string;
      }
    | {
        ok: false;
        error: string;
        bucket?: string;
        path?: string;
      }
    | null = null;

  if (selectedUserId && selectedDocKind && selectedUserAllowed) {
    try {
      selectedDocPreview = await getUserDocSignedUrl({ userId: selectedUserId, kind: selectedDocKind });
    } catch (e) {
      selectedDocPreview = {
        ok: false,
        error: e instanceof Error ? e.message : "Failed to load document",
      };
    }
  }

  const bookingsSeries = buildDailySeries(
    trendStart,
    30,
    bookingsTrendRows.map((r) => ({ day: r.day, value: r.bookings })),
  );
  const revenueSeries = buildDailySeries(
    trendStart,
    30,
    revenueTrendRows.map((r) => ({ day: r.day, value: r.revenueCents })),
  );
  const signupsSeries = buildDailySeries(
    trendStart,
    30,
    signupsTrendRows.map((r) => ({ day: r.day, value: r.signups })),
  );

  const revenue30 = revenue30Agg._sum.totalCents ?? 0;
  const revenuePrev30 = revenuePrev30Agg._sum.totalCents ?? 0;
  const bookingsDelta = pctChange(bookingsMonthly, bookingsPrev30);
  const revenueDelta = pctChange(revenue30, revenuePrev30);
  const users30 = signupsSeries.reduce((a, b) => a + b, 0);

  const signupsCurrent30 = users30;
  const signupsPrev = signupsPrev30;
  const signupsPct = pctChange(signupsCurrent30, signupsPrev);

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
    await requireRole("ADMIN");

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

  async function approveBooking(formData: FormData) {
    "use server";
    await requireRole("ADMIN");

    const bookingId = String(formData.get("bookingId") ?? "");
    if (!bookingId) return;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, paidAt: true },
    });

    if (!booking) return;
    if (booking.status !== "PENDING_APPROVAL") return;
    if (!booking.paidAt) return;

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED" },
    });

    revalidatePath("/admin");
    revalidatePath("/host");
    revalidatePath("/renter");
    revalidatePath(`/bookings/${bookingId}`);
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

  async function updateMyProfile(formData: FormData) {
    "use server";
    const { supabaseUser, dbUser } = await requireRole("ADMIN");

    const nameRaw = String(formData.get("name") ?? "").trim();
    const surnameRaw = String(formData.get("surname") ?? "").trim();

    const name = nameRaw ? nameRaw.slice(0, 120) : "";
    const surname = surnameRaw ? surnameRaw.slice(0, 120) : "";

    await supabaseAdmin().auth.admin.updateUserById(supabaseUser.id, {
      user_metadata: {
        ...supabaseUser.user_metadata,
        name: name || null,
        surname: surname || null,
        profileUpdatedAt: new Date().toISOString(),
      },
    });

    await prisma.user.update({
      where: { id: dbUser.id },
      data: { name: name || null, surname: surname || null },
    });

    revalidatePath("/admin");
  }

  const sidebarSections: { key: AdminSection; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "settings", label: "Settings" },
    { key: "analytics", label: "Analytics" },
    { key: "vehicles", label: "Vehicles" },
    { key: "users", label: "Users" },
    { key: "bookings", label: "Bookings" },
    { key: "messages", label: "Messages" },
    { key: "payments", label: "Payments" },
    { key: "risk", label: "Risk & safety" },
    { key: "support", label: "Support" },
  ];

  const bookingChats = section === "messages"
    ? await prisma.booking.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          listing: { select: { id: true, title: true, host: { select: { email: true } } } },
          renter: { select: { email: true } },
          _count: { select: { messages: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              body: true,
              createdAt: true,
              sender: { select: { email: true, role: true } },
            },
          },
        },
        take: 200,
      })
    : null;

  const currentQuery = {
    q: q || undefined,
    bookingStatus: bookingStatus ?? undefined,
    ticketStatus: ticketStatus ?? undefined,
    incidentStatus: incidentStatus ?? undefined,
  };

  return (
    <main className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
          <p className="text-sm text-foreground/60">Operations, finance, trust & safety, and support.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Signed in</CardTitle>
            <CardDescription className="break-all">{viewerDbUser.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              {viewerProfileImageSignedUrl ? (
                <img
                  src={viewerProfileImageSignedUrl}
                  alt="Profile"
                  className="h-10 w-10 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full border border-border bg-muted" aria-label="No profile photo" />
              )}
              <div className="min-w-0 space-y-1">
                <div className="text-sm text-foreground/60">
                  {viewerName ? (
                    <div>
                      {viewerName}
                      {viewerSurname ? ` ${viewerSurname}` : ""}
                    </div>
                  ) : (
                    <div>No name set.</div>
                  )}
                </div>
                <Link
                  href={adminHref({ section: "settings", ...currentQuery })}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Open settings
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
            <CardDescription>Select a dashboard section.</CardDescription>
          </CardHeader>
          <CardContent>
            <nav className="flex flex-col gap-1">
              {sidebarSections.map((s) => {
                const active = s.key === section;
                return (
                  <Link
                    key={s.key}
                    href={adminHref({ section: s.key, ...currentQuery })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-accent/25 bg-accent-soft text-foreground"
                        : "border-transparent text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {s.label}
                  </Link>
                );
              })}
            </nav>
          </CardContent>
        </Card>
      </aside>

      <div className="space-y-8">
      {section === "overview" ? (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Platform overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total users</CardTitle>
              <CardDescription>Hosts + renters + admins.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{formatInt(totalUsers)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total cars listed</CardTitle>
              <CardDescription>All vehicle listings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{formatInt(totalCars)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total bookings</CardTitle>
              <CardDescription>All-time.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{formatInt(totalBookingsAll)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active rentals now</CardTitle>
              <CardDescription>Confirmed, currently in-range.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{formatInt(activeRentalsNow)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Bookings (daily)</CardTitle>
              <CardDescription>Last 24 hours.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{formatInt(bookingsDaily)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bookings (weekly)</CardTitle>
              <CardDescription>Last 7 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{formatInt(bookingsWeekly)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bookings (monthly)</CardTitle>
              <CardDescription>Last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{formatInt(bookingsMonthly)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue overview</CardTitle>
              <CardDescription>Gross confirmed bookings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {formatMoneyZar(grossRevenue._sum.totalCents ?? 0)}
              </div>
              <div className="mt-1 text-sm text-foreground/60">
                Total across all currencies; commission tracking not configured
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Cancellations</CardTitle>
              <CardDescription>All-time cancelled bookings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{formatInt(cancellations)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Disputes & incidents</CardTitle>
              <CardDescription>Open/in-review incidents.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{formatInt(openIncidentsCount)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Support tickets</CardTitle>
              <CardDescription>Open/in-progress.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{formatInt(openTicketsCount)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Finance</CardTitle>
              <CardDescription>Refunds/chargebacks.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-foreground/60">Not enabled yet</div>
            </CardContent>
          </Card>
        </div>
      </section>

      ) : null}

      {section === "settings" ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Settings</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Update your name and surname.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={updateMyProfile} className="space-y-3">
                  <label className="block">
                    <div className="mb-1 text-sm">Name</div>
                    <Input name="name" defaultValue={viewerName} placeholder="Name" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm">Surname</div>
                    <Input name="surname" defaultValue={viewerSurname} placeholder="Surname" />
                  </label>
                  <Button type="submit" className="w-full">
                    Save
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile photo</CardTitle>
                <CardDescription>Images only • Max 8MB</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {viewerProfileImageSignedUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={viewerProfileImageSignedUrl}
                      alt="Profile"
                      className="h-16 w-16 rounded-full border border-border object-cover"
                    />
                    <div className="text-sm text-foreground/60">Current photo</div>
                  </div>
                ) : (
                  <div className="text-sm text-foreground/60">No profile photo yet.</div>
                )}

                <AdminProfilePhotoForm />
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {section === "analytics" ? (
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Analytics (last 30 days)</h2>
            <div className="text-sm text-foreground/60">Power BI-style overview using live platform data.</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 border border-border bg-card text-foreground shadow-sm hover:bg-muted"
              href="/api/admin/exports/stats"
            >
              Download stats (CSV)
            </a>
            <div className="text-xs text-foreground/60">Updated {now.toLocaleString("en-ZA")}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-8">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Bookings trend</CardTitle>
                  <CardDescription>Daily bookings created (30 days).</CardDescription>
                </div>
                <Badge variant="info">30d</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-3xl font-semibold tabular-nums">{formatInt(bookingsMonthly)}</div>
                  <div className="text-sm text-foreground/60">Avg/day: {formatInt(Math.round(bookingsMonthly / 30))}</div>
                </div>
                <div className="text-sm text-foreground/60">
                  {bookingsDelta === null ? (
                    <span>vs previous 30d: —</span>
                  ) : (
                    <span>
                      vs previous 30d: {bookingsDelta >= 0 ? "+" : ""}
                      {bookingsDelta.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <MiniBars values={bookingsSeries} className="text-accent/35" />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Top cities</CardTitle>
                  <CardDescription>Confirmed bookings + revenue (30 days).</CardDescription>
                </div>
                <Badge variant="info">30d</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {topCitiesRows.length === 0 ? (
                <div className="text-sm text-foreground/60">No confirmed bookings in the last 30 days.</div>
              ) : (
                <div className="space-y-2">
                  {topCitiesRows.map((r) => (
                    <div key={r.city} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.city}</div>
                        <div className="text-xs text-foreground/60">{formatInt(r.bookings)} bookings</div>
                      </div>
                      <div className="shrink-0 tabular-nums text-foreground/80">{formatMoneyZar(r.revenueCents)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-6">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Revenue trend</CardTitle>
                  <CardDescription>Confirmed booking revenue (ZAR).</CardDescription>
                </div>
                <Badge variant="info">30d</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-3xl font-semibold tabular-nums">{formatMoneyZar(revenue30)}</div>
                  <div className="text-sm text-foreground/60">Avg/day: {formatMoneyZar(Math.round(revenue30 / 30))}</div>
                </div>
                <div className="text-sm text-foreground/60">
                  {revenueDelta === null ? (
                    <span>vs previous 30d: —</span>
                  ) : (
                    <span>
                      vs previous 30d: {revenueDelta >= 0 ? "+" : ""}
                      {revenueDelta.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <MiniBars values={revenueSeries} className="text-accent/35" />
              </div>
              <div className="mt-2 text-xs text-foreground/60">If you support multiple currencies, split revenue by currency.</div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-6">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>New users</CardTitle>
                  <CardDescription>Signups created (30 days).</CardDescription>
                </div>
                <Badge variant="info">30d</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-3xl font-semibold tabular-nums">{formatInt(signupsCurrent30)}</div>
                  <div className="text-sm text-foreground/60">Avg/day: {formatInt(Math.round(signupsCurrent30 / 30))}</div>
                </div>
                <div className="text-sm text-foreground/60">
                  {signupsPct === null ? (
                    <span>vs previous 30d: —</span>
                  ) : (
                    <span>
                      vs previous 30d: {signupsPct >= 0 ? "+" : ""}
                      {signupsPct.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <MiniBars values={signupsSeries} className="text-accent/35" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      ) : null}

      {section === "vehicles" ? (
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
                    <th className="px-3 py-2">Docs</th>
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
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <a
                            href={`/api/admin/listing-documents/licenseDisk?listingId=${encodeURIComponent(l.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-border text-foreground/80 hover:text-foreground"
                          >
                            Disk
                          </a>
                          <a
                            href={`/api/admin/listing-documents/registration?listingId=${encodeURIComponent(l.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-border text-foreground/80 hover:text-foreground"
                          >
                            Reg
                          </a>
                          <a
                            href={`/api/admin/listing-documents/licenseCard?listingId=${encodeURIComponent(l.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-border text-foreground/80 hover:text-foreground"
                          >
                            Card
                          </a>
                        </div>
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

      ) : null}

      {section === "users" ? (
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">User verification</h2>
            <div className="text-sm text-foreground/60">
              Review uploaded documents and update verification statuses.
            </div>
          </div>

          <form className="flex flex-wrap items-center gap-2" action="/admin" method="get">
            <input type="hidden" name="section" value={section} />
            <Input name="q" defaultValue={q} placeholder="Search by email" className="max-w-sm" />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </div>

        <div className="grid gap-4 lg:grid-cols-[520px_1fr]">
          <div className="space-y-3">
            {allUsers.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No users found</CardTitle>
                  <CardDescription>Try clearing the search term.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              allUsers.map((u) => {
                const active = selectedUserId === u.id;
                const clearHref = adminHref({ section: "users", q: q || null });
                return (
                  <Card key={u.id} className={active ? "border-accent/40 bg-accent-subtle" : undefined}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="break-all">{u.email}</CardTitle>
                          <CardDescription>Created {iso(u.createdAt)}</CardDescription>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Badge variant={badgeVariantForRole(u.role)}>{u.role}</Badge>
                            <Badge variant={badgeVariantForUserStatus(u.status)}>{u.status}</Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={adminHref({
                              section: "users",
                              q: q || null,
                              userId: u.id,
                              doc: "profile",
                            })}
                          >
                            <Button variant={active && selectedDocKind === "profile" ? "primary" : "secondary"}>
                              Profile
                            </Button>
                          </Link>
                          <Link
                            href={adminHref({
                              section: "users",
                              q: q || null,
                              userId: u.id,
                              doc: "id",
                            })}
                          >
                            <Button variant={active && selectedDocKind === "id" ? "primary" : "secondary"}>
                              ID
                            </Button>
                          </Link>
                          <Link
                            href={adminHref({
                              section: "users",
                              q: q || null,
                              userId: u.id,
                              doc: "license",
                            })}
                          >
                            <Button variant={active && selectedDocKind === "license" ? "primary" : "secondary"}>
                              DL
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm text-foreground/60">ID:</div>
                        <Badge variant={badgeVariantForVerificationStatus(u.idVerificationStatus)}>
                          {u.idVerificationStatus}
                        </Badge>
                        <div className="ml-2 text-sm text-foreground/60">License:</div>
                        <Badge variant={badgeVariantForVerificationStatus(u.driversLicenseStatus)}>
                          {u.driversLicenseStatus}
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <form action={setUserRole} className="flex flex-wrap items-center gap-2">
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
                          <Button type="submit" variant="secondary">
                            Update role
                          </Button>
                        </form>

                        <form action={setUserStatus} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <select
                            name="status"
                            defaultValue={u.status}
                            className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                          </select>
                          <Button type="submit" variant="secondary">
                            Update status
                          </Button>
                        </form>

                        <form action={setUserVerification} className="flex flex-wrap items-center gap-2">
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
                          <Button type="submit" variant="secondary">
                            Update ID status
                          </Button>
                        </form>

                        <form action={setUserVerification} className="flex flex-wrap items-center gap-2">
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
                          <Button type="submit" variant="secondary">
                            Update DL status
                          </Button>
                        </form>

                        <div className="pt-1">
                          <Link href={clearHref} className="text-sm text-foreground/60 underline decoration-border">
                            Clear selection
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Document preview</CardTitle>
                <CardDescription>
                  {selectedUser && !selectedUserAllowed
                    ? "Admins are hidden from verification"
                    : selectedUser && selectedDocKind
                      ? `${selectedUser.email} • ${selectedDocKind.toUpperCase()}`
                      : selectedUser
                        ? "Select a document type (Profile / ID / DL)"
                        : "Select a user to preview documents"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedUser ? (
                  <div className="text-sm text-foreground/60">
                    Pick a user on the left, then choose Profile/ID/DL.
                  </div>
                ) : !selectedUserAllowed ? (
                  <div className="text-sm text-foreground/60">
                    Admin accounts are not included in the verification workflow.
                  </div>
                ) : !selectedDocKind ? (
                  <div className="text-sm text-foreground/60">
                    Choose a document type to load a preview.
                  </div>
                ) : !selectedDocPreview ? (
                  <div className="text-sm text-foreground/60">Loading…</div>
                ) : selectedDocPreview.ok ? (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedDocPreview.signedUrl}
                        alt={`${selectedDocKind} document`}
                        className="max-h-[70vh] w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={selectedDocPreview.signedUrl} target="_blank" rel="noreferrer">
                        <Button>Open full</Button>
                      </a>
                      <a
                        href={`/api/admin/user-documents/${selectedDocKind}?userId=${encodeURIComponent(selectedUser.id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="secondary">Open via API</Button>
                      </a>
                      <div className="text-xs text-foreground/60">
                        Signed URL (5 min) • {selectedDocPreview.bucket}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Could not load document</div>
                    <div className="text-sm text-foreground/60">{selectedDocPreview.error}</div>
                    <div className="text-sm text-foreground/60">
                      If this user uploaded docs, confirm the bucket exists (default: user-documents) and
                      `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set.
                    </div>
                    <div>
                      <a
                        href={`/api/admin/user-documents/${selectedDocKind}?userId=${encodeURIComponent(selectedUser.id)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline decoration-border"
                      >
                        Open API response
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      ) : null}

      {section === "bookings" ? (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Booking & operations</h2>

        <form className="flex flex-wrap items-center gap-2" action="/admin" method="get">
          <input type="hidden" name="section" value={section} />
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <select
            name="bookingStatus"
            defaultValue={bookingStatus ?? ""}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            <option value="">All statuses</option>
            <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
            <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Ongoing bookings</CardTitle>
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
                        {b.status === "PENDING_APPROVAL" ? (
                          <form action={approveBooking}>
                            <input type="hidden" name="bookingId" value={b.id} />
                            <Button type="submit" variant="secondary">Approve</Button>
                          </form>
                        ) : !b.stripeCheckoutSessionId && b.status === "PENDING_PAYMENT" ? (
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

      ) : null}

      {section === "payments" ? (
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Payments & financials</h2>
          <a
            className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 border border-border bg-card text-foreground shadow-sm hover:bg-muted"
            href="/api/admin/exports/payouts"
          >
            Download payouts (CSV)
          </a>
        </div>
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
            <CardTitle>EFT confirmations</CardTitle>
            <CardDescription>Bookings awaiting manual/EFT payment confirmation.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingEftBookings.length === 0 ? (
              <div className="text-sm text-foreground/60">No pending EFT bookings.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2">Listing</th>
                      <th className="px-3 py-2">Host</th>
                      <th className="px-3 py-2">Renter</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEftBookings.map((b) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="px-3 py-2">{b.listing.title}</td>
                        <td className="px-3 py-2">{b.listing.host.email}</td>
                        <td className="px-3 py-2">{b.renter.email}</td>
                        <td className="px-3 py-2">
                          {(b.totalCents / 100).toFixed(0)} {b.currency}
                        </td>
                        <td className="px-3 py-2">{iso(b.createdAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              className="text-sm underline"
                              href={`/api/admin/booking-payment-proof/${encodeURIComponent(b.id)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View proof
                            </a>
                            <form action={markManualBookingPaid}>
                              <input type="hidden" name="bookingId" value={b.id} />
                              <Button type="submit" variant="secondary">Mark paid</Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <AdminPayoutCalculator />

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

      ) : null}

      {section === "messages" ? (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Messages</h2>
        <p className="text-sm text-foreground/60">Admins can see and open any booking chat.</p>

        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2">Booking</th>
                <th className="px-3 py-2">Host</th>
                <th className="px-3 py-2">Renter</th>
                <th className="px-3 py-2">Last message</th>
                <th className="px-3 py-2">Count</th>
              </tr>
            </thead>
            <tbody>
              {(bookingChats ?? []).map((b) => {
                const last = b.messages[0] ?? null;
                return (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{b.listing.title}</div>
                      <div className="text-xs text-foreground/60">
                        <Link className="text-accent hover:underline" href={`/bookings/${encodeURIComponent(b.id)}`}>
                          Open chat
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-2">{b.listing.host.email}</td>
                    <td className="px-3 py-2">{b.renter.email}</td>
                    <td className="px-3 py-2">
                      {last ? (
                        <div>
                          <div className="text-xs text-foreground/60">
                            {last.sender.email} • {last.sender.role} • {last.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                          </div>
                          <div className="line-clamp-2">{last.body}</div>
                        </div>
                      ) : (
                        <span className="text-foreground/60">No messages</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{b._count.messages}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {section === "risk" ? (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Risk, trust & safety</h2>

        <form className="flex flex-wrap items-center gap-2" action="/admin" method="get">
          <input type="hidden" name="section" value={section} />
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
                      <th className="px-3 py-2">Details</th>
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
                        <td className="px-3 py-2">
                          {r.details ? (
                            <div className="max-w-[520px] whitespace-pre-wrap break-words text-xs text-foreground/80">
                              {r.details}
                            </div>
                          ) : (
                            <span className="text-xs text-foreground/50">-</span>
                          )}
                        </td>
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

      ) : null}

      {section === "support" ? (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Support tools</h2>

        <form className="flex flex-wrap items-center gap-2" action="/admin" method="get">
          <input type="hidden" name="section" value={section} />
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

      ) : null}
      </div>
    </main>
  );
}
