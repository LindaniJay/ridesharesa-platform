import test from "node:test";
import assert from "node:assert/strict";

test("city counts aggregation filters out null/empty values", () => {
  const listings = [
    { id: "1", city: "Cape Town", title: "Car 1" },
    { id: "2", city: "Johannesburg", title: "Car 2" },
    { id: "3", city: "Cape Town", title: "Car 3" },
    { id: "4", city: "", title: "Car 4" },
    { id: "5", city: null as any, title: "Car 5" },
  ];

  const cityCounts = new Map<string, { count: number }>();
  for (const listing of listings) {
    const key = String(listing.city ?? "").trim();
    if (!key) continue;
    const current = cityCounts.get(key);
    cityCounts.set(key, {
      count: (current?.count ?? 0) + 1,
    });
  }

  assert.equal(cityCounts.size, 2);
  assert.equal(cityCounts.get("Cape Town")?.count, 2);
  assert.equal(cityCounts.get("Johannesburg")?.count, 1);
});

test("city ranking sorts by count descending", () => {
  const cityCounts = new Map<string, { count: number }>();
  cityCounts.set("Cape Town", { count: 5 });
  cityCounts.set("Johannesburg", { count: 12 });
  cityCounts.set("Durban", { count: 3 });

  const ranked = [...cityCounts.entries()]
    .map(([city, value]) => ({ city, count: value.count }))
    .sort((left, right) => right.count - left.count || left.city.localeCompare(right.city));

  assert.equal(ranked[0].city, "Johannesburg");
  assert.equal(ranked[1].city, "Cape Town");
  assert.equal(ranked[2].city, "Durban");
});

test("top cities limited to N results", () => {
  const cities = [
    { city: "Cape Town", count: 10 },
    { city: "Johannesburg", count: 20 },
    { city: "Durban", count: 5 },
    { city: "Pretoria", count: 8 },
    { city: "Bloemfontein", count: 2 },
  ];

  const top4 = cities.slice(0, 4);
  assert.equal(top4.length, 4);
  assert.deepEqual(top4, [
    { city: "Cape Town", count: 10 },
    { city: "Johannesburg", count: 20 },
    { city: "Durban", count: 5 },
    { city: "Pretoria", count: 8 },
  ]);
});

test("average daily rate calculation", () => {
  const listings = [
    { dailyRateCents: 50000 },
    { dailyRateCents: 75000 },
    { dailyRateCents: 100000 },
  ];

  const average = listings.length
    ? Math.round(listings.reduce((sum, l) => sum + l.dailyRateCents, 0) / listings.length / 100)
    : 0;

  assert.equal(average, 750); // ZAR
});

test("average rate handles empty listings", () => {
  const listings: Array<{ dailyRateCents: number }> = [];

  const average = listings.length
    ? Math.round(listings.reduce((sum, l) => sum + l.dailyRateCents, 0) / listings.length / 100)
    : 0;

  assert.equal(average, 0);
});

test("instant booking count filtering", () => {
  const listings = [
    { id: "1", instantBooking: true },
    { id: "2", instantBooking: false },
    { id: "3", instantBooking: true },
    { id: "4", instantBooking: true },
  ];

  const count = listings.filter(l => l.instantBooking).length;
  assert.equal(count, 3);
});
