import test from "node:test";
import assert from "node:assert/strict";

import { cn } from "../app/lib/cn";

test("cn merges classNames correctly", () => {
  assert.equal(cn("px-2 py-1", "px-3"), "px-2 py-1 px-3");
});

test("cn removes falsy values", () => {
  assert.equal(cn("px-2", false && "py-1", undefined, null, "text-sm"), "px-2 text-sm");
});

test("cn handles empty input", () => {
  assert.equal(cn(), "");
  assert.equal(cn(""), "");
});

test("cn preserves order for non-conflicting classes", () => {
  assert.equal(cn("text-base", "font-semibold", "text-foreground"), "text-base font-semibold text-foreground");
});

test("cn concatenates duplicate classes", () => {
  assert.equal(cn("px-2", "px-2"), "px-2 px-2");
});

test("cn concatenates all spacing classes without conflict resolution", () => {
  assert.equal(cn("gap-2", "gap-4"), "gap-2 gap-4");
  assert.equal(cn("m-0", "mx-4"), "m-0 mx-4");
});
