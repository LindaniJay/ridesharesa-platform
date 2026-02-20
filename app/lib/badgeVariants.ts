import type {
  BookingStatus,
  IncidentStatus,
  ListingStatus,
  PayoutStatus,
  Role,
  SupportTicketStatus,
  UserStatus,
  VerificationStatus,
} from "@prisma/client";

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

export function badgeVariantForRole(role: Role): BadgeVariant {
  if (role === "ADMIN") return "info";
  if (role === "HOST") return "neutral";
  return "neutral";
}

export function badgeVariantForBookingStatus(status: BookingStatus): BadgeVariant {
  switch (status) {
    case "CONFIRMED":
      return "success";
    case "PENDING_PAYMENT":
      return "warning";
    case "PENDING_APPROVAL":
      return "info";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export function badgeVariantForListingStatus(status: ListingStatus): BadgeVariant {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "ACTIVE":
      return "success";
    case "PAUSED":
      return "warning";
    default:
      return "neutral";
  }
}

export function badgeVariantForSupportTicketStatus(status: SupportTicketStatus): BadgeVariant {
  switch (status) {
    case "OPEN":
      return "warning";
    case "IN_PROGRESS":
      return "info";
    case "RESOLVED":
      return "success";
    case "CLOSED":
      return "neutral";
    default:
      return "neutral";
  }
}

export function badgeVariantForIncidentStatus(status: IncidentStatus): BadgeVariant {
  switch (status) {
    case "OPEN":
      return "danger";
    case "IN_REVIEW":
      return "warning";
    case "RESOLVED":
      return "success";
    case "CLOSED":
      return "neutral";
    default:
      return "neutral";
  }
}

export function badgeVariantForPayoutStatus(status: PayoutStatus): BadgeVariant {
  switch (status) {
    case "PENDING":
      return "warning";
    case "PAID":
      return "success";
    case "FAILED":
      return "danger";
    default:
      return "neutral";
  }
}

export function badgeVariantForUserStatus(status: UserStatus): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "danger";
    default:
      return "neutral";
  }
}

export function badgeVariantForVerificationStatus(status: VerificationStatus): BadgeVariant {
  switch (status) {
    case "VERIFIED":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
      return "danger";
    default:
      return "neutral";
  }
}
