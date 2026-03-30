/**
 * Rule-based risk scoring for users and bookings.
 * Returns a score 0–100 and a human-readable label.
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskScore {
  score: number; // 0–100
  level: RiskLevel;
  flags: string[];
}

function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export interface UserRiskInput {
  idVerificationStatus: string;
  driversLicenseStatus: string;
  status: string;
  cancelledBookings: number;
  totalBookings: number;
  incidentCount: number;
  accountAgeDays: number;
}

export function scoreUser(u: UserRiskInput): RiskScore {
  let score = 0;
  const flags: string[] = [];

  if (u.status === "SUSPENDED") {
    score += 40;
    flags.push("Account suspended");
  }
  if (u.idVerificationStatus === "UNVERIFIED" || u.idVerificationStatus === "REJECTED") {
    score += 20;
    flags.push("ID not verified");
  }
  if (u.driversLicenseStatus === "UNVERIFIED" || u.driversLicenseStatus === "REJECTED") {
    score += 20;
    flags.push("License not verified");
  }
  if (u.incidentCount > 0) {
    score += Math.min(u.incidentCount * 15, 30);
    flags.push(`${u.incidentCount} incident report(s)`);
  }
  if (u.totalBookings > 0) {
    const cancellationRate = u.cancelledBookings / u.totalBookings;
    if (cancellationRate > 0.5) {
      score += 20;
      flags.push(`High cancellation rate (${Math.round(cancellationRate * 100)}%)`);
    }
  }
  if (u.accountAgeDays < 7) {
    score += 10;
    flags.push("New account (< 7 days)");
  }

  return { score: Math.min(score, 100), level: levelFromScore(score), flags };
}

export interface BookingRiskInput {
  idVerificationStatus: string;
  driversLicenseStatus: string;
  accountAgeDays: number;
  totalCents: number;
  sameDay: boolean; // booked same day as start
  cancelledBookings: number;
  totalBookings: number;
}

export function scoreBooking(b: BookingRiskInput): RiskScore {
  let score = 0;
  const flags: string[] = [];

  if (b.idVerificationStatus === "UNVERIFIED" || b.idVerificationStatus === "REJECTED") {
    score += 25;
    flags.push("Renter ID unverified");
  }
  if (b.driversLicenseStatus === "UNVERIFIED" || b.driversLicenseStatus === "REJECTED") {
    score += 25;
    flags.push("Renter license unverified");
  }
  if (b.accountAgeDays < 7) {
    score += 15;
    flags.push("New account renter");
  }
  if (b.totalCents > 500_000) {
    score += 15;
    flags.push("High-value booking (> R5000)");
  }
  if (b.sameDay) {
    score += 10;
    flags.push("Same-day booking");
  }
  if (b.totalBookings > 0 && b.cancelledBookings / b.totalBookings > 0.5) {
    score += 15;
    flags.push("Renter has high cancellation rate");
  }

  return { score: Math.min(score, 100), level: levelFromScore(score), flags };
}

export function riskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case "critical": return "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20";
    case "high":     return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20";
    case "medium":   return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20";
    default:         return "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20";
  }
}

export function riskLabel(level: RiskLevel): string {
  switch (level) {
    case "critical": return "Critical";
    case "high":     return "High";
    case "medium":   return "Medium";
    default:         return "Low";
  }
}
