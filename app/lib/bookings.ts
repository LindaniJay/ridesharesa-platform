import { randomInt } from "node:crypto";

import { Prisma, type BookingStatus } from "@prisma/client";

export const CHAUFFEUR_RATE_CENTS_PER_KM = 10 * 100;

export const RESERVED_BOOKING_STATUSES: BookingStatus[] = [
  "PENDING_PAYMENT",
  "PENDING_APPROVAL",
  "CONFIRMED",
];

export const STRIPE_SUCCESS_EVENT_TYPES = new Set<string>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export const STRIPE_RELEASE_EVENT_TYPES = new Set<string>([
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

export function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) ? days : 0;
}

export function calculateBookingTotalCents(params: {
  days: number;
  dailyRateCents: number;
  chauffeurEnabled: boolean;
  chauffeurKm: number;
}) {
  const baseCents = params.days * params.dailyRateCents;
  const chauffeurCents =
    params.chauffeurEnabled && params.chauffeurKm > 0
      ? params.chauffeurKm * CHAUFFEUR_RATE_CENTS_PER_KM
      : 0;

  return {
    baseCents,
    chauffeurCents,
    totalCents: baseCents + chauffeurCents,
  };
}

export function generatePaymentReferenceCode() {
  return String(randomInt(100000, 1_000_000));
}

export function isPaymentReferenceConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;

  const target = error.meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");

  return targetText.includes("paymentReference");
}

export function nextBookingStatusForStripeEvent(type: string): BookingStatus | null {
  if (STRIPE_SUCCESS_EVENT_TYPES.has(type)) return "PENDING_APPROVAL";
  if (STRIPE_RELEASE_EVENT_TYPES.has(type)) return "CANCELLED";
  return null;
}