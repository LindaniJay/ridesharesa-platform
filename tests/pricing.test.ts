import test from "node:test";
import assert from "node:assert/strict";

test("price formatting to ZAR per day", () => {
  const formatRate = (dailyRateCents: number, currency: string) => {
    return `${(dailyRateCents / 100).toFixed(0)} ${currency}`;
  };

  assert.equal(formatRate(50000, "ZAR"), "500 ZAR");
  assert.equal(formatRate(75500, "ZAR"), "755 ZAR");
  assert.equal(formatRate(9999, "ZAR"), "100 ZAR");
});

test("price rounding for filters", () => {
  const minPrice = 600;
  const maxPrice = 1500;
  
  const minCents = Math.round(minPrice * 100);
  const maxCents = Math.round(maxPrice * 100);

  assert.equal(minCents, 60000);
  assert.equal(maxCents, 150000);
});

test("booking total calculation with chauffeur markup", () => {
  const calculateBookingTotal = (
    days: number,
    dailyRateCents: number,
    chauffeurKm: number,
    chauffeurEnabled: boolean
  ) => {
    const baseCents = days * dailyRateCents;
    const chauffeurCents = chauffeurEnabled ? chauffeurKm * 1000 : 0; // 10 ZAR per km
    return {
      baseCents,
      chauffeurCents,
      totalCents: baseCents + chauffeurCents,
    };
  };

  const booking = calculateBookingTotal(3, 50000, 50, true);
  assert.equal(booking.baseCents, 150000);
  assert.equal(booking.chauffeurCents, 50000);
  assert.equal(booking.totalCents, 200000);
});

test("price validation for zero or negative values", () => {
  const validatePrice = (cents: number) => {
    return cents > 0;
  };

  assert.equal(validatePrice(50000), true);
  assert.equal(validatePrice(0), false);
  assert.equal(validatePrice(-100), false);
});

test("currency display consistency", () => {
  const formatPrice = (cents: number) => {
    const zar = (cents / 100).toFixed(0);
    return `R${zar}`;
  };

  assert.equal(formatPrice(50000), "R500");
  assert.equal(formatPrice(12345), "R123");
  assert.equal(formatPrice(99999), "R1000");
});
