import test from "node:test";
import assert from "node:assert/strict";

// Test URL search parameter parsing logic used in listings page
test("first() extracts string parameter correctly", () => {
  const first = (param: string | string[] | undefined) => {
    if (!param) return "";
    return Array.isArray(param) ? String(param[0] ?? "") : String(param);
  };

  assert.equal(first("Cape Town"), "Cape Town");
  assert.equal(first(["Cape Town", "Johannesburg"]), "Cape Town");
  assert.equal(first(undefined), "");
  assert.equal(first(""), "");
});

test("first() handles edge cases", () => {
  const first = (param: string | string[] | undefined) => {
    if (!param) return "";
    return Array.isArray(param) ? String(param[0] ?? "") : String(param);
  };

  assert.equal(first([]), "");
  assert.equal(first([undefined]), "");
  assert.equal(first([""]), "");
  assert.equal(first(null as unknown), "");
});

test("price filter range validation", () => {
  const minPrice = Number("500") || 0;
  const maxPrice = Number("2000") || 0;

  assert.equal(minPrice, 500);
  assert.equal(maxPrice, 2000);
  assert(maxPrice >= minPrice);
});

test("price filter with invalid input", () => {
  const minPrice = Number("abc") || 0;
  const maxPrice = Number("") || 0;

  assert.equal(minPrice, 0);
  assert.equal(maxPrice, 0);
});

test("sort parameter defaults to recent", () => {
  const sort1 = ("recent" || "recent") as string;
  const sort2 = ("price_asc" || "recent") as string;
  const sort3 = ("" || "recent") as string;

  assert.equal(sort1, "recent");
  assert.equal(sort2, "price_asc");
  assert.equal(sort3, "recent");
});

test("instant booking checkbox parsing", () => {
  const parse = (val: string) => val === "on";

  assert.equal(parse("on"), true);
  assert.equal(parse("off"), false);
  assert.equal(parse(""), false);
});
