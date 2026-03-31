import test from "node:test";
import assert from "node:assert/strict";

test("date validation checks if both start and end exist", () => {
  const start1 = new Date("2025-04-15");
  const end1 = new Date("2025-04-20");
  const hasValidDates1 = Boolean(start1 && end1) && 
    !Number.isNaN(start1.getTime()) && 
    !Number.isNaN(end1.getTime()) && 
    end1.getTime() > start1.getTime();
  
  assert.equal(hasValidDates1, true);

  const start2 = null;
  const end2 = new Date("2025-04-20");
  const hasValidDates2 = Boolean(start2 && end2);
  
  assert.equal(hasValidDates2, false);
});

test("date comparison handles invalid dates", () => {
  const start = new Date("invalid");
  const end = new Date("2025-04-20");
  const isValid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime());
  
  assert.equal(isValid, false);
});

test("date range overlaps with existing booking", () => {
  const startDate = new Date("2025-04-15");
  const endDate = new Date("2025-04-20");
  const bookingStart = new Date("2025-04-18");
  const bookingEnd = new Date("2025-04-22");

  const overlaps = startDate < bookingEnd && endDate > bookingStart;
  assert.equal(overlaps, true);
});

test("date ranges do not overlap", () => {
  const startDate = new Date("2025-04-15");
  const endDate = new Date("2025-04-17");
  const bookingStart = new Date("2025-04-18");
  const bookingEnd = new Date("2025-04-22");

  const overlaps = startDate < bookingEnd && endDate > bookingStart;
  assert.equal(overlaps, false);
});

test("current time availability check", () => {
  const now = new Date();
  const bookingStart = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
  const bookingEnd = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour from now

  const isOccupiedNow = bookingStart <= now && now <= bookingEnd;
  assert.equal(isOccupiedNow, true);
});

test("future booking does not block current availability", () => {
  const now = new Date();
  const bookingStart = new Date(now.getTime() + 1000 * 60 * 60 * 24); // Tomorrow
  const bookingEnd = new Date(now.getTime() + 1000 * 60 * 60 * 48); // Day after

  const isOccupiedNow = bookingStart <= now && now <= bookingEnd;
  assert.equal(isOccupiedNow, false);
});
