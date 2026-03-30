import test from "node:test";
import assert from "node:assert/strict";

import {
  CHAUFFEUR_RATE_CENTS_PER_KM,
  RESERVED_BOOKING_STATUSES,
  calculateBookingTotalCents,
  generatePaymentReferenceCode,
  nextBookingStatusForStripeEvent,
} from "../app/lib/bookings";

test("reserved booking statuses include pending payment holds", () => {
  assert.deepEqual(RESERVED_BOOKING_STATUSES, ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED"]);
});

test("booking totals include chauffeur charges only when enabled", () => {
  const withChauffeur = calculateBookingTotalCents({
    days: 3,
    dailyRateCents: 50000,
    chauffeurEnabled: true,
    chauffeurKm: 25,
  });

  assert.equal(withChauffeur.baseCents, 150000);
  assert.equal(withChauffeur.chauffeurCents, 25 * CHAUFFEUR_RATE_CENTS_PER_KM);
  assert.equal(withChauffeur.totalCents, 150000 + 25 * CHAUFFEUR_RATE_CENTS_PER_KM);

  const withoutChauffeur = calculateBookingTotalCents({
    days: 3,
    dailyRateCents: 50000,
    chauffeurEnabled: false,
    chauffeurKm: 25,
  });

  assert.equal(withoutChauffeur.chauffeurCents, 0);
  assert.equal(withoutChauffeur.totalCents, 150000);
});

test("payment reference codes are six digits", () => {
  const code = generatePaymentReferenceCode();
  assert.match(code, /^\d{6}$/);
});

test("stripe event mapping keeps booking lifecycle consistent", () => {
  assert.equal(nextBookingStatusForStripeEvent("checkout.session.completed"), "PENDING_APPROVAL");
  assert.equal(nextBookingStatusForStripeEvent("checkout.session.async_payment_succeeded"), "PENDING_APPROVAL");
  assert.equal(nextBookingStatusForStripeEvent("checkout.session.async_payment_failed"), "CANCELLED");
  assert.equal(nextBookingStatusForStripeEvent("checkout.session.expired"), "CANCELLED");
  assert.equal(nextBookingStatusForStripeEvent("payment_intent.created"), null);
});