import { revalidatePath } from "next/cache";
import Link from "next/link";
import AdminBulkSelector from "@/app/admin/AdminBulkSelector.client";
import { AdminAreaChart, AdminBarChart } from "@/app/admin/AdminCharts.client";
import AdminCommandPalette from "@/app/admin/AdminCommandPalette.client";
import AdminKeyboardShortcuts from "@/app/admin/AdminKeyboardShortcuts.client";
import { writeAuditLog } from "@/app/lib/auditLog";
import { scoreBooking, scoreUser, riskBadgeClass, riskLabel } from "@/app/lib/riskScore";

export const dynamic = "force-dynamic";

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

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseStatus<T extends string>(value: unknown, allowed: readonly T[]) {
  const v = String(value ?? "");
  return allowed.includes(v as T) ? (v as T) : null;
}

type AdminSection =
  | "overview"
  | "audit"
  | "settings"
  | "analytics"
  | "vehicles"
  | "users"
  | "bookings"
  | "messages"
  | "payments"
  | "risk"
  | "support";

type UserDocKind = "profile" | "id" | "license" | "proof_residence";
type ListingDocKind = "licenseDisk" | "registration" | "licenseCard";

function parseUserDocKind(value: unknown): UserDocKind | null {
  const v = String(value ?? "").trim();
  return v === "profile" || v === "id" || v === "license" || v === "proof_residence" ? v : null;
}


function parseAuditSnapshot(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isSensitiveAuditKey(key: string) {
  const normalized = key.toLowerCase();
  return [
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "session",
    "apiKey",
    "serviceRole",
    "signedurl",
    "signed_url",
  ].some((needle) => normalized.includes(needle.toLowerCase()));
}

function auditComparable(value: unknown): string {
  if (value === null || value === undefined) return "__EMPTY__";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildAuditDiffRows(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ key: string; before: string; after: string; changed: boolean }> {
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  return Array.from(keys)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const beforeRaw = before ? before[key] : undefined;
      const afterRaw = after ? after[key] : undefined;
      const changed = auditComparable(beforeRaw) !== auditComparable(afterRaw);

      if (isSensitiveAuditKey(key)) {
        return {
          key,
          before: beforeRaw === null || beforeRaw === undefined ? "-" : "[REDACTED]",
          after: afterRaw === null || afterRaw === undefined ? "-" : "[REDACTED]",
          changed,
        };
      }

      return {
        key,
        before: formatAuditValue(beforeRaw),
        after: formatAuditValue(afterRaw),
        changed,
      };
    });
}

function summarizeRiskFlags(flags: string[], maxItems = 2): string {
  if (!flags.length) return "No major risk flags";
  const visible = flags.slice(0, maxItems);
  const hiddenCount = Math.max(0, flags.length - visible.length);
  return hiddenCount > 0 ? `${visible.join("; ")}; +${hiddenCount} more` : visible.join("; ");
}

function parseListingDocKind(value: unknown): ListingDocKind | null {
  const v = String(value ?? "").trim();
  return v === "licenseDisk" || v === "registration" || v === "licenseCard" ? v : null;
}

function isPdfPath(value: string | null | undefined) {
  if (!value) return false;
  return value.toLowerCase().split("?")[0].endsWith(".pdf");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeStoragePath(path: string, bucket: string) {
  const trimmed = path.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

  let normalized = trimmed.replace(/^\/+/, "");
  if (normalized.startsWith(`${bucket}/`)) {
    normalized = normalized.slice(bucket.length + 1);
  }
  return normalized;
}

async function findSupabaseUserByEmail(email: string) {
  const admin = supabaseAdmin();
  const perPage = 200;

  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const users = data?.users ?? [];
    const found = users.find((u) => normalizeEmail(u.email || "") === normalizeEmail(email));
    if (found) return found;
    if (users.length < perPage) break;
  }

  return null;
}

async function getUserDocSignedUrl(params: { userId: string; kind: UserDocKind; userEmail?: string | null }) {
  const bucket = process.env.SUPABASE_USER_DOCS_BUCKET || "user-documents";

  const admin = supabaseAdmin();

  const candidatePaths: string[] = [];

  const { data, error } = await admin.storage.from(bucket).list(params.userId, { limit: 100, offset: 0 });
  if (!error) {
    const objects = data ?? [];
    const match = objects.find((o) => typeof o.name === "string" && o.name.startsWith(`${params.kind}.`));
    if (match) {
      candidatePaths.push(`${params.userId}/${match.name}`);
    }
  }

  if (params.userEmail) {
    const supaUser = await findSupabaseUserByEmail(params.userEmail);
    const metadata = (supaUser?.user_metadata ?? {}) as Record<string, unknown>;
    const metadataPath =
      params.kind === "profile"
        ? metadata.profileImagePath
        : params.kind === "id"
          ? metadata.idDocumentImagePath
          : params.kind === "license"
            ? metadata.driversLicenseImagePath
            : metadata.proofOfResidenceImagePath;
    if (typeof metadataPath === "string" && metadataPath.trim()) {
      candidatePaths.push(metadataPath.trim());
    }
  }

  const path = candidatePaths
    .map((candidate) => sanitizeStoragePath(candidate, bucket))
    .find((candidate) => candidate.length > 0) || null;

  if (!path) {
    return {
      ok: false as const,
      error: "Document not found (user has not uploaded it yet)",
      bucket,
    };
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return {
      ok: true as const,
      bucket: "public-url",
      path,
      signedUrl: path,
    };
  }

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

async function getListingDocSignedUrl(params: { listingId: string; kind: ListingDocKind }) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.listingId },
    select: {
      licenseDiskImageUrl: true,
      registrationImageUrl: true,
      licenseCardImageUrl: true,
    },
  });

  if (!listing) {
    return {
      ok: false as const,
      error: "Listing not found",
    };
  }

  const stored =
    params.kind === "licenseDisk"
      ? listing.licenseDiskImageUrl
      : params.kind === "registration"
        ? listing.registrationImageUrl
        : listing.licenseCardImageUrl;

  if (!stored) {
    return {
      ok: false as const,
      error: "Document not uploaded yet",
    };
  }

  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    return {
      ok: true as const,
      bucket: "public-url",
      path: stored,
      signedUrl: stored,
    };
  }

  const bucket = process.env.SUPABASE_LISTING_DOCS_BUCKET || "listing-documents";
  const normalizedStored = sanitizeStoragePath(stored, bucket);
  const admin = supabaseAdmin();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(normalizedStored, 60 * 5);

  if (error || !data?.signedUrl) {
    return {
      ok: false as const,
      error:
        error?.message ||
        `Could not create signed URL (ensure bucket "${bucket}" exists and SUPABASE_SERVICE_ROLE_KEY is set).`,
      bucket,
      path: normalizedStored,
    };
  }

  return {
    ok: true as const,
    bucket,
    path: normalizedStored,
    signedUrl: data.signedUrl,
  };
}

function parseSection(value: unknown): AdminSection | null {
  const v = String(value ?? "").trim();
  const allowed: readonly AdminSection[] = [
    "overview",
    "audit",
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
    listingId?: string;
    listingDoc?: string;
  }>;
}) {
  const { dbUser: viewerDbUser, supabaseUser: viewerSupabaseUser } = await requireRole("ADMIN");

  const resolved = searchParams ? await searchParams : undefined;
  const q = (resolved?.q ?? "").trim();
  const section = parseSection(resolved?.section) ?? "overview";
  const selectedUserId = (resolved?.userId ?? "").trim() || null;
  const selectedDocKind = parseUserDocKind(resolved?.doc);
  const selectedListingId = (resolved?.listingId ?? "").trim() || null;
  const selectedListingDocKind = parseListingDocKind(resolved?.listingDoc);
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
        renter: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            idVerificationStatus: true,
            driversLicenseStatus: true,
          },
        },
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
        paymentReference: true,
        stripeCheckoutSessionId: true,
        paidAt: true,
        startDate: true,
        endDate: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        renter: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            idVerificationStatus: true,
            driversLicenseStatus: true,
          },
        },
        listing: { select: { id: true, title: true, city: true, host: { select: { email: true } } } },
      },
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ["PENDING_PAYMENT", "PENDING_APPROVAL"] },
        stripeCheckoutSessionId: null,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        totalCents: true,
        currency: true,
        startDate: true,
        createdAt: true,
        renter: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            idVerificationStatus: true,
            driversLicenseStatus: true,
          },
        },
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

  const statsUserIds = Array.from(
    new Set([
      ...allUsers.map((user) => user.id),
      ...bookingsOps.map((booking) => booking.renter.id),
      ...pendingEftBookings.map((booking) => booking.renter.id),
    ]),
  );

  const [bookingCountRows, cancelledBookingCountRows, incidentCountRows] = statsUserIds.length
    ? await Promise.all([
        prisma.booking.groupBy({
          by: ["renterId"],
          where: { renterId: { in: statsUserIds } },
          _count: { _all: true },
        }),
        prisma.booking.groupBy({
          by: ["renterId"],
          where: { renterId: { in: statsUserIds }, status: "CANCELLED" },
          _count: { _all: true },
        }),
        prisma.incidentReport.groupBy({
          by: ["userId"],
          where: { userId: { in: statsUserIds } },
          _count: { _all: true },
        }),
      ])
    : [[], [], []];

  const totalBookingsByUser = new Map(bookingCountRows.map((row) => [row.renterId, row._count._all] as const));
  const cancelledBookingsByUser = new Map(
    cancelledBookingCountRows.map((row) => [row.renterId, row._count._all] as const),
  );
  const incidentCountByUser = new Map(incidentCountRows.map((row) => [row.userId, row._count._all] as const));

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
      selectedDocPreview = await getUserDocSignedUrl({
        userId: selectedUserId,
        kind: selectedDocKind,
        userEmail: selectedUser?.email ?? null,
      });
    } catch (e) {
      selectedDocPreview = {
        ok: false,
        error: e instanceof Error ? e.message : "Failed to load document",
      };
    }
  }

  const selectedListing = selectedListingId ? listingsAll.find((l) => l.id === selectedListingId) ?? null : null;

  let selectedListingDocPreview:
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

  if (selectedListingId && selectedListingDocKind) {
    try {
      selectedListingDocPreview = await getListingDocSignedUrl({
        listingId: selectedListingId,
        kind: selectedListingDocKind,
      });
    } catch (e) {
      selectedListingDocPreview = {
        ok: false,
        error: e instanceof Error ? e.message : "Failed to load listing document",
      };
    }
  }

  const bookingsSeries = buildDailySeries(
    trendStart,
    30,
    Array.isArray(bookingsTrendRows)
      ? bookingsTrendRows.map((r) => ({ day: r.day, value: r.bookings }))
      : [],
  );
  const revenueSeries = buildDailySeries(
    trendStart,
    30,
    Array.isArray(revenueTrendRows)
      ? revenueTrendRows.map((r) => ({ day: r.day, value: typeof r.revenueCents === "number" ? r.revenueCents : 0 }))
      : [],
  );
  const signupsSeries = buildDailySeries(
    trendStart,
    30,
    Array.isArray(signupsTrendRows)
      ? signupsTrendRows.map((r) => ({ day: r.day, value: r.signups }))
      : [],
  );

  const revenue30 = revenue30Agg && revenue30Agg._sum ? revenue30Agg._sum.totalCents ?? 0 : 0;
  const revenuePrev30 = revenuePrev30Agg && revenuePrev30Agg._sum ? revenuePrev30Agg._sum.totalCents ?? 0 : 0;
  const bookingsDelta = pctChange(bookingsMonthly, bookingsPrev30);
  const revenueDelta = pctChange(revenue30, revenuePrev30);
  const users30 = signupsSeries.reduce((a, b) => a + b, 0);

  const signupsCurrent30 = users30;
  const signupsPrev = signupsPrev30;
  const signupsPct = pctChange(signupsCurrent30, signupsPrev);

  async function approveListing(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");
    const listingId = String(formData.get("listingId") ?? "");
    if (!listingId) return;
    const before = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { isApproved: true, status: true },
    });
    await prisma.listing.update({ where: { id: listingId }, data: { isApproved: true } });
    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "approveListing",
      targetId: listingId,
      targetKind: "listing",
      before: before ?? undefined,
      after: { ...(before ?? {}), isApproved: true },
    });
    revalidatePath("/listings");
    revalidatePath("/admin");
  }

  async function setListingStatus(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");
    const listingId = String(formData.get("listingId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!listingId) return;
    if (!['ACTIVE', 'PAUSED', 'DRAFT'].includes(status)) return;
    const before = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { status: true, isApproved: true },
    });
    await prisma.listing.update({ where: { id: listingId }, data: { status: status as ListingStatus } });
    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "setListingStatus",
      targetId: listingId,
      targetKind: "listing",
      before: before ?? undefined,
      after: { ...(before ?? {}), status },
    });
    revalidatePath("/listings");
    revalidatePath("/admin");
  }

  async function setUserRole(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "");
    if (!userId) return;
    if (!['ADMIN', 'HOST', 'RENTER'].includes(role)) return;
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    await prisma.user.update({ where: { id: userId }, data: { role: role as Role } });
    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "setUserRole",
      targetId: userId,
      targetKind: "user",
      before: before ?? undefined,
      after: { role },
    });
    revalidatePath("/admin");
  }

  async function setUserStatus(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");
    const userId = String(formData.get("userId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!userId) return;
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) return;
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    await prisma.user.update({ where: { id: userId }, data: { status: status as UserStatus } });
    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "setUserStatus",
      targetId: userId,
      targetKind: "user",
      before: before ?? undefined,
      after: { status },
    });
    revalidatePath("/admin");
  }

  async function setUserVerification(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");
    const userId = String(formData.get("userId") ?? "");
    const field = String(formData.get("field") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!userId) return;
    if (!['idVerificationStatus', 'driversLicenseStatus'].includes(field)) return;
    if (!['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'].includes(status)) return;
    const nextStatus = status as VerificationStatus;
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { idVerificationStatus: true, driversLicenseStatus: true },
    });
    await prisma.user.update({
      where: { id: userId },
      data: field === "idVerificationStatus" ? { idVerificationStatus: nextStatus } : { driversLicenseStatus: nextStatus },
    });
    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "setUserVerification",
      targetId: userId,
      targetKind: "user",
      before: before ?? undefined,
      after:
        field === "idVerificationStatus"
          ? { ...(before ?? {}), idVerificationStatus: nextStatus }
          : { ...(before ?? {}), driversLicenseStatus: nextStatus },
    });
    revalidatePath("/admin");
  }

  async function markManualBookingPaid(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");

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

    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "markManualBookingPaid",
      targetId: bookingId,
      targetKind: "booking",
      before: { status: booking.status, stripeCheckoutSessionId: booking.stripeCheckoutSessionId },
      after: { status: "CONFIRMED", paidAt: true },
    });

    revalidatePath("/admin");
  }

  async function approveBooking(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");

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

    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "approveBooking",
      targetId: bookingId,
      targetKind: "booking",
      before: { status: booking.status, paidAt: Boolean(booking.paidAt) },
      after: { status: "CONFIRMED" },
    });

    revalidatePath("/admin");
    revalidatePath("/host");
    revalidatePath("/renter");
    revalidatePath(`/bookings/${bookingId}`);
  }

  async function setSupportTicketStatus(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");
    const ticketId = String(formData.get("ticketId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!ticketId) return;
    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) return;
    const before = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { status: true } });
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: status as SupportTicketStatus } });
    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "setSupportTicketStatus",
      targetId: ticketId,
      targetKind: "supportTicket",
      before: before ?? undefined,
      after: { status },
    });
    revalidatePath("/admin");
  }

  async function setIncidentStatus(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");
    const incidentId = String(formData.get("incidentId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!incidentId) return;
    if (!['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'].includes(status)) return;
    const before = await prisma.incidentReport.findUnique({ where: { id: incidentId }, select: { status: true } });
    await prisma.incidentReport.update({ where: { id: incidentId }, data: { status: status as IncidentStatus } });
    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "setIncidentStatus",
      targetId: incidentId,
      targetKind: "incident",
      before: before ?? undefined,
      after: { status },
    });
    revalidatePath("/admin");
  }

  async function createHostPayout(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");

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

    const payout = await prisma.hostPayout.create({
      data: {
        hostId,
        amountCents,
        currency,
        status: "PENDING",
        periodStart: periodStart && !Number.isNaN(periodStart.getTime()) ? periodStart : null,
        periodEnd: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd : null,
      },
    });

    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "createHostPayout",
      targetId: payout.id,
      targetKind: "payout",
      after: { hostId, amountCents, currency },
    });

    revalidatePath("/admin");
  }

  async function setPayoutStatus(formData: FormData) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");

    const payoutId = String(formData.get("payoutId") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    if (!payoutId) return;
    if (!['PENDING', 'PAID', 'FAILED'].includes(status)) return;

    const before = await prisma.hostPayout.findUnique({ where: { id: payoutId }, select: { status: true } });

    await prisma.hostPayout.update({
      where: { id: payoutId },
      data: { status: status as PayoutStatus },
    });
    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "setPayoutStatus",
      targetId: payoutId,
      targetKind: "payout",
      before: before ?? undefined,
      after: { status },
    });
    revalidatePath("/admin");
  }

  async function bulkApproveListings(ids: string[]) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");
    const listingIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean))).slice(0, 100);
    if (listingIds.length === 0) return;

    await prisma.listing.updateMany({
      where: { id: { in: listingIds } },
      data: { isApproved: true },
    });

    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "bulkApproveListings",
      targetKind: "listing",
      after: { listingIds, count: listingIds.length, isApproved: true },
    });

    revalidatePath("/admin");
    revalidatePath("/listings");
  }

  async function bulkVerifyUserIds(ids: string[]) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");
    const userIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean))).slice(0, 100);
    if (userIds.length === 0) return;

    await prisma.user.updateMany({
      where: { id: { in: userIds }, role: { not: "ADMIN" } },
      data: { idVerificationStatus: "VERIFIED" },
    });

    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "bulkVerifyUserIds",
      targetKind: "user",
      after: { userIds, count: userIds.length, idVerificationStatus: "VERIFIED" },
    });

    revalidatePath("/admin");
  }

  async function bulkSuspendUsers(ids: string[]) {
    "use server";
    const { dbUser: adminUser } = await requireRole("ADMIN");
    const userIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean))).slice(0, 100);
    if (userIds.length === 0) return;

    await prisma.user.updateMany({
      where: { id: { in: userIds }, role: { not: "ADMIN" } },
      data: { status: "SUSPENDED" },
    });

    await writeAuditLog({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: "bulkSuspendUsers",
      targetKind: "user",
      after: { userIds, count: userIds.length, status: "SUSPENDED" },
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
    { key: "audit", label: "Audit log" },
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

  let adminAuditLogError: string | null = null;
  const adminAuditLogs = section === "audit"
    ? await prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }).catch(() => {
        adminAuditLogError = "Audit log table is not available yet. Apply the Prisma migration to enable this section.";
        return [];
      })
    : [];

  const currentQuery = {
    q: q || undefined,
    bookingStatus: bookingStatus ?? undefined,
    ticketStatus: ticketStatus ?? undefined,
    incidentStatus: incidentStatus ?? undefined,
  };

  return (
    <>
    <AdminKeyboardShortcuts />
    <main className="grid gap-6 lg:grid-cols-[260px_1fr] mobile-tight">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
          <p className="text-sm text-foreground/60">Operations, finance, trust &amp; safety, and support.</p>
          <div className="pt-2">
            <AdminCommandPalette />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Signed in</CardTitle>
            <CardDescription className="break-all">{viewerDbUser.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              {viewerProfileImageSignedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL with predictable dimensions
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
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Admin Dashboard Overview</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Hosts, renters, admins</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{formatInt(totalUsers)}</div>
              <div className="mt-2 text-xs text-foreground/60">User management, onboarding, verification</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Listings</CardTitle>
              <CardDescription>Cars, compliance, photos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{formatInt(totalCars)}</div>
              <div className="mt-2 text-xs text-foreground/60">Listing approval, document checks</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bookings</CardTitle>
              <CardDescription>All-time, status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{formatInt(totalBookingsAll)}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                  <div className="text-foreground/60">Last 24h</div>
                  <div className="font-semibold text-sm">{formatInt(bookingsDaily)}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                  <div className="text-foreground/60">Last 7d</div>
                  <div className="font-semibold text-sm">{formatInt(bookingsWeekly)}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                  <div className="text-foreground/60">Last 30d</div>
                  <div className="font-semibold text-sm">{formatInt(bookingsMonthly)}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                  <div className="text-foreground/60">Cancelled</div>
                  <div className="font-semibold text-sm">{formatInt(cancellations)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
              <CardDescription>Confirmed ZAR bookings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{formatMoneyZar(grossRevenue && grossRevenue._sum ? grossRevenue._sum.totalCents ?? 0 : 0)}</div>
              <div className="mt-2 text-xs text-foreground/60">Payouts, refunds, chargebacks</div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Verification</CardTitle>
              <CardDescription>Document workflow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">ID, License, Proof of Residence</div>
              <div className="mt-2 text-xs text-foreground/60">Admin review, status updates, compliance</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Support</CardTitle>
              <CardDescription>Tickets, incidents, disputes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{formatInt(openTicketsCount)} open tickets</div>
              <div className="mt-2 text-xs text-foreground/60">Chat, messaging, help center</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Risk & Safety</CardTitle>
              <CardDescription>Trust, insurance, fraud</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{formatInt(openIncidentsCount)} open incidents</div>
              <div className="mt-2 text-xs text-foreground/60">Trust badges, insurance, compliance</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>Trends, charts, exports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">30d stats, CSV export</div>
              <div className="mt-2 text-xs text-foreground/60">Bookings, revenue, signups</div>
            </CardContent>
          </Card>
        </div>
      </section>

      ) : null}

      {section === "audit" ? (
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Audit log</h2>
          <div className="text-sm text-foreground/60">Recent admin actions across listings, users, bookings, payouts, support, and risk operations.</div>
        </div>

        {adminAuditLogError ? (
          <Card>
            <CardHeader>
              <CardTitle>Audit log unavailable</CardTitle>
              <CardDescription>{adminAuditLogError}</CardDescription>
            </CardHeader>
          </Card>
        ) : adminAuditLogs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No audit entries yet</CardTitle>
              <CardDescription>Admin actions will appear here after they are performed.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            {adminAuditLogs.map((entry) => {
              const before = parseAuditSnapshot(entry.before);
              const after = parseAuditSnapshot(entry.after);
              const diffRows = buildAuditDiffRows(before, after);
              const changedCount = diffRows.filter((row) => row.changed).length;
              return (
                <Card key={entry.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{entry.action}</CardTitle>
                        <CardDescription>
                          {entry.adminEmail}
                          {entry.targetKind ? ` • ${entry.targetKind}` : ""}
                          {entry.targetId ? ` • ${entry.targetId}` : ""}
                        </CardDescription>
                      </div>
                      <div className="text-xs text-foreground/60">{entry.createdAt.toLocaleString("en-ZA")}</div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
                      <span className="rounded-full border border-border bg-muted/60 px-2 py-1">
                        {diffRows.length} field{diffRows.length === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full border border-border bg-muted/60 px-2 py-1">
                        {changedCount} changed
                      </span>
                      <span className="rounded-full border border-border bg-muted/60 px-2 py-1">
                        sensitive keys redacted
                      </span>
                    </div>

                    {diffRows.length === 0 ? (
                      <div className="text-sm text-foreground/50">No snapshot payload available for this action.</div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="dashboard-table">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-3 py-2">Field</th>
                              <th className="px-3 py-2">Before</th>
                              <th className="px-3 py-2">After</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diffRows.map((row) => (
                              <tr
                                key={row.key}
                                className={cn(
                                  "border-t border-border align-top",
                                  row.changed ? "bg-amber-500/10" : "bg-transparent",
                                )}
                              >
                                <td className="px-3 py-2 text-foreground/60">{row.key}</td>
                                <td className="px-3 py-2 break-all">{row.before}</td>
                                <td className="px-3 py-2 break-all">{row.after}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed URL with predictable dimensions */}
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
              className="btn-link-secondary"
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
                <AdminAreaChart
                  data={(Array.isArray(bookingsSeries) ? bookingsSeries : []).map((value, index) => {
                    const day = new Date(trendStart);
                    day.setDate(trendStart.getDate() + index);
                    return {
                      label: day.toLocaleDateString("en-ZA", { month: "short", day: "numeric" }),
                      value,
                    };
                  })}
                  valueLabel="Bookings"
                  color="#6366f1"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Top cities</CardTitle>
                  <CardDescription>Confirmed bookings (30 days).</CardDescription>
                </div>
                <Badge variant="info">30d</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {Array.isArray(topCitiesRows) && topCitiesRows.length === 0 ? (
                <div className="text-sm text-foreground/60">No confirmed bookings in the last 30 days.</div>
              ) : Array.isArray(topCitiesRows) ? (
                <AdminBarChart
                  data={topCitiesRows.map((row) => ({ name: row.city, value: row.bookings }))}
                  valueLabel="Bookings"
                  color="#22d3ee"
                  horizontal
                />
              ) : null}
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
                <AdminAreaChart
                  data={(Array.isArray(revenueSeries) ? revenueSeries : []).map((value, index) => {
                    const day = new Date(trendStart);
                    day.setDate(trendStart.getDate() + index);
                    return {
                      label: day.toLocaleDateString("en-ZA", { month: "short", day: "numeric" }),
                      value,
                    };
                  })}
                  valueLabel="Revenue (cents)"
                  color="#10b981"
                  format={(value) => `R${(value / 100).toFixed(0)}`}
                />
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
                <AdminAreaChart
                  data={(Array.isArray(signupsSeries) ? signupsSeries : []).map((value, index) => {
                    const day = new Date(trendStart);
                    day.setDate(trendStart.getDate() + index);
                    return {
                      label: day.toLocaleDateString("en-ZA", { month: "short", day: "numeric" }),
                      value,
                    };
                  })}
                  valueLabel="Signups"
                  color="#f59e0b"
                />
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
        {pendingListings.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Bulk listing actions</CardTitle>
              <CardDescription>Approve multiple pending listings at once.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminBulkSelector
                noun="listing"
                items={pendingListings.map((listing) => ({
                  id: listing.id,
                  label: listing.title,
                  sub: `${listing.city} • ${listing.host.email}`,
                }))}
                actions={[
                  {
                    label: "Approve selected",
                    variant: "primary",
                    confirm: "Approve {n} selected listings?",
                    action: bulkApproveListings,
                  },
                ]}
              />
            </CardContent>
          </Card>
        ) : null}
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
            <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="dashboard-table">
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
                   {Array.isArray(listingsAll)
                     ? listingsAll.map((l) => (
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
                               <Link
                                 href={adminHref({ section: "vehicles", listingId: l.id, listingDoc: "licenseDisk" })}
                                 className={cn(
                                   "underline decoration-border hover:text-foreground",
                                   selectedListingId === l.id && selectedListingDocKind === "licenseDisk"
                                     ? "text-foreground"
                                     : "text-foreground/80",
                                 )}
                               >
                                 Disk
                               </Link>
                               <Link
                                 href={adminHref({ section: "vehicles", listingId: l.id, listingDoc: "registration" })}
                                 className={cn(
                                   "underline decoration-border hover:text-foreground",
                                   selectedListingId === l.id && selectedListingDocKind === "registration"
                                     ? "text-foreground"
                                     : "text-foreground/80",
                                 )}
                               >
                                 Reg
                               </Link>
                               <Link
                                 href={adminHref({ section: "vehicles", listingId: l.id, listingDoc: "licenseCard" })}
                                 className={cn(
                                   "underline decoration-border hover:text-foreground",
                                   selectedListingId === l.id && selectedListingDocKind === "licenseCard"
                                     ? "text-foreground"
                                     : "text-foreground/80",
                                 )}
                               >
                                 Card
                               </Link>
                             </div>
                           </td>
                           <td className="px-3 py-2">{iso(l.createdAt)}</td>
                         </tr>
                       ))
                     : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listing document preview</CardTitle>
            <CardDescription>
              {selectedListing && selectedListingDocKind
                ? `${selectedListing.title} • ${selectedListingDocKind}`
                : "Select Disk, Reg, or Card in the table to preview"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedListing ? (
              <div className="text-sm text-foreground/60">Pick a listing document from the table above.</div>
            ) : !selectedListingDocKind ? (
              <div className="text-sm text-foreground/60">Choose which listing document to preview.</div>
            ) : !selectedListingDocPreview ? (
              <div className="text-sm text-foreground/60">Loading…</div>
            ) : selectedListingDocPreview.ok ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  {isPdfPath(selectedListingDocPreview.path) ? (
                    <iframe
                      src={selectedListingDocPreview.signedUrl}
                      title="Listing document preview"
                      className="h-[70vh] w-full"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedListingDocPreview.signedUrl}
                      alt="Listing document"
                      className="max-h-[70vh] w-full object-contain"
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/api/admin/listing-documents/${selectedListingDocKind}?listingId=${encodeURIComponent(selectedListing.id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button>Open full</Button>
                  </a>
                  <a
                    href={selectedListingDocPreview.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="secondary">Open signed URL</Button>
                  </a>
                  <div className="text-xs text-foreground/60">Signed URL (5 min) • {selectedListingDocPreview.bucket}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">Could not load listing document</div>
                <div className="text-sm text-foreground/60">{selectedListingDocPreview.error}</div>
              </div>
            )}
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

          <div className="flex flex-wrap items-center gap-2">
            <a
              className="btn-link-secondary"
              href="/api/admin/exports/users"
            >
              Export users (CSV)
            </a>
            <form className="flex flex-wrap items-center gap-2" action="/admin" method="get">
              <input type="hidden" name="section" value={section} />
              <Input name="q" defaultValue={q} placeholder="Search by email" className="max-w-sm" />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
          </div>
        </div>

        {allUsers.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Bulk user actions</CardTitle>
              <CardDescription>Apply verification or status changes to multiple users.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminBulkSelector
                noun="user"
                items={allUsers.map((user) => ({
                  id: user.id,
                  label: user.email,
                  sub: `${user.role} • ${user.status}`,
                }))}
                actions={[
                  {
                    label: "Verify selected IDs",
                    variant: "primary",
                    confirm: "Mark ID verification as VERIFIED for {n} selected users?",
                    action: bulkVerifyUserIds,
                  },
                  {
                    label: "Suspend selected",
                    variant: "ghost",
                    confirm: "Suspend {n} selected users?",
                    action: bulkSuspendUsers,
                  },
                ]}
              />
            </CardContent>
          </Card>
        ) : null}

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
                const accountAgeDays = Math.max(0, Math.floor((now.getTime() - u.createdAt.getTime()) / (24 * 60 * 60 * 1000)));
                const userRisk = scoreUser({
                  status: u.status,
                  idVerificationStatus: u.idVerificationStatus,
                  driversLicenseStatus: u.driversLicenseStatus,
                  cancelledBookings: cancelledBookingsByUser.get(u.id) ?? 0,
                  totalBookings: totalBookingsByUser.get(u.id) ?? 0,
                  incidentCount: incidentCountByUser.get(u.id) ?? 0,
                  accountAgeDays,
                });
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
                            <span className={riskBadgeClass(userRisk.level)}>
                              {riskLabel(userRisk.level)} risk {userRisk.score}
                            </span>
                            {/* Document verification controls */}
                            <form action={setUserVerification} className="flex items-center gap-2">
                              <input type="hidden" name="userId" value={u.id} />
                              <select
                                name="field"
                                defaultValue="idVerificationStatus"
                                className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                              >
                                <option value="idVerificationStatus">ID</option>
                                <option value="driversLicenseStatus">License</option>
                              </select>
                              <select
                                name="status"
                                defaultValue={u.idVerificationStatus}
                                className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                              >
                                <option value="UNVERIFIED">Unverified</option>
                                <option value="PENDING">Pending</option>
                                <option value="VERIFIED">Verified</option>
                                <option value="REJECTED">Rejected</option>
                              </select>
                              <Button type="submit" variant="secondary">Update</Button>
                            </form>
                            <Link
                              href={adminHref({ section: "users", userId: u.id, doc: "id" })}
                              className="underline text-xs decoration-border hover:text-foreground"
                            >
                              View ID
                            </Link>
                            <Link
                              href={adminHref({ section: "users", userId: u.id, doc: "license" })}
                              className="underline text-xs decoration-border hover:text-foreground"
                            >
                              View License
                            </Link>
                          </div>
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
                          <Link
                            href={adminHref({
                              section: "users",
                              q: q || null,
                              userId: u.id,
                              doc: "proof_residence",
                            })}
                          >
                            <Button variant={active && selectedDocKind === "proof_residence" ? "primary" : "secondary"}>
                              POR
                            </Button>
                          </Link>
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
                      <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground/70">
                        {summarizeRiskFlags(userRisk.flags)}
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
                      {isPdfPath(selectedDocPreview.path) ? (
                        <iframe
                          src={selectedDocPreview.signedUrl}
                          title={`${selectedDocKind} document`}
                          className="h-[70vh] w-full"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedDocPreview.signedUrl}
                          alt={`${selectedDocKind} document`}
                          className="max-h-[70vh] w-full object-contain"
                        />
                      )}
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Booking & operations</h2>
          <a
            className="btn-link-secondary"
            href="/api/admin/exports/bookings"
          >
            Export bookings (CSV)
          </a>
        </div>

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
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="dashboard-table">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2">Listing</th>
                    <th className="px-3 py-2">Host</th>
                    <th className="px-3 py-2">Renter</th>
                    <th className="px-3 py-2">Dates</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Risk</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Ref#</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                   {Array.isArray(bookingsOps)
                     ? bookingsOps.map((b) => {
                         const bookingRisk = scoreBooking({
                           idVerificationStatus: b.renter.idVerificationStatus,
                           driversLicenseStatus: b.renter.driversLicenseStatus,
                           accountAgeDays: Math.max(0, Math.floor((now.getTime() - b.renter.createdAt.getTime()) / (24 * 60 * 60 * 1000))),
                           totalCents: b.totalCents,
                           sameDay: iso(b.createdAt) === iso(b.startDate),
                           cancelledBookings: cancelledBookingsByUser.get(b.renter.id) ?? 0,
                           totalBookings: totalBookingsByUser.get(b.renter.id) ?? 0,
                         });
                         return (
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
                             <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", riskBadgeClass(bookingRisk.level))} title={bookingRisk.flags.join(" • ")}>
                               {riskLabel(bookingRisk.level)} {bookingRisk.score}
                             </span>
                               <div className="mt-1 max-w-[220px] text-xs text-foreground/60">{summarizeRiskFlags(bookingRisk.flags, 1)}</div>
                           </td>
                           <td className="px-3 py-2">
                             <Badge variant={b.stripeCheckoutSessionId ? "info" : "warning"}>
                               {b.stripeCheckoutSessionId ? "Stripe" : "EFT"}
                             </Badge>
                           </td>
                           <td className="px-3 py-2">
                             {b.paymentReference ? (
                               <span className="font-mono text-sm font-semibold">{b.paymentReference}</span>
                             ) : (
                               <span className="text-xs text-foreground/50">—</span>
                             )}
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
                         );
                       })
                     : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
          <table className="dashboard-table">
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
            className="btn-link-secondary"
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
            <CardDescription>Bookings awaiting payment confirmation or admin approval.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingEftBookings.length === 0 ? (
              <div className="text-sm text-foreground/60">No pending EFT bookings.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="dashboard-table">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2">Listing</th>
                      <th className="px-3 py-2">Host</th>
                      <th className="px-3 py-2">Renter</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Risk</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEftBookings.map((b) => {
                      const bookingRisk = scoreBooking({
                        idVerificationStatus: b.renter.idVerificationStatus,
                        driversLicenseStatus: b.renter.driversLicenseStatus,
                        accountAgeDays: Math.max(0, Math.floor((now.getTime() - b.renter.createdAt.getTime()) / (24 * 60 * 60 * 1000))),
                        totalCents: b.totalCents,
                        sameDay: iso(b.createdAt) === iso(b.startDate),
                        cancelledBookings: cancelledBookingsByUser.get(b.renter.id) ?? 0,
                        totalBookings: totalBookingsByUser.get(b.renter.id) ?? 0,
                      });
                      return (
                      <tr key={b.id} className="border-t border-border">
                        <td className="px-3 py-2">{b.listing.title}</td>
                        <td className="px-3 py-2">{b.listing.host.email}</td>
                        <td className="px-3 py-2">{b.renter.email}</td>
                        <td className="px-3 py-2">
                          <Badge variant={badgeVariantForBookingStatus(b.status)}>{b.status}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", riskBadgeClass(bookingRisk.level))} title={bookingRisk.flags.join(" • ")}>
                            {riskLabel(bookingRisk.level)} {bookingRisk.score}
                          </span>
                          <div className="mt-1 max-w-[220px] text-xs text-foreground/60">{summarizeRiskFlags(bookingRisk.flags, 1)}</div>
                        </td>
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
                            {b.status === "PENDING_PAYMENT" ? (
                              <form action={markManualBookingPaid}>
                                <input type="hidden" name="bookingId" value={b.id} />
                                <Button type="submit" variant="secondary">Mark paid</Button>
                              </form>
                            ) : null}
                            {b.status === "PENDING_APPROVAL" ? (
                              <form action={approveBooking}>
                                <input type="hidden" name="bookingId" value={b.id} />
                                <Button type="submit" variant="secondary">Approve</Button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
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
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="dashboard-table">
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

        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
          <table className="dashboard-table">
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
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="dashboard-table">
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
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="dashboard-table">
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
    </>
  );
}

