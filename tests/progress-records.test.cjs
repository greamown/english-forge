const { test } = require("node:test");
const assert = require("node:assert/strict");
const R = require("../progress-records.js");

test("stamp only touches changed keys and marks removals", () => {
  const first = R.stamp({}, { a: { done: true }, b: { done: true } }, 100);
  assert.deepEqual(first, { a: { done: true, at: 100 }, b: { done: true, at: 100 } });
  const second = R.stamp(first, { a: { done: true }, c: { n: 1 } }, 200);
  assert.deepEqual(second, { a: { done: true, at: 100 }, b: { at: 200 }, c: { n: 1, at: 200 } });
  assert.equal(R.stamp(second, { a: { done: true }, c: { n: 1 } }, 300).b.at, 200, "existing removal is not re-stamped");
});

test("two devices merge without losing either side", () => {
  const base = R.stamp({}, { a: { done: true } }, 100);
  const phone = R.stamp(base, { a: { done: true }, b: { done: true } }, 200); // learned b
  const laptop = R.stamp(base, { c: { done: true } }, 300); // undid a, learned c
  const merged = R.merge(phone, laptop);
  assert.deepEqual(Object.keys(R.live(merged)).sort(), ["b", "c"]);
  assert.ok(R.equal(merged, R.merge(laptop, phone)), "merge order does not matter");
  assert.ok(R.equal(merged, R.merge(merged, phone)), "re-merging is a no-op");
  assert.equal(R.latest(merged), 300);
});

test("equal ignores key order from the cloud", () => {
  assert.ok(R.equal({ a: { x: 1, y: 2, at: 5 } }, { a: { at: 5, y: 2, x: 1 } }));
  assert.ok(!R.equal({ a: { x: 1, at: 5 } }, { a: { x: 1, at: 6 } }));
});

test("clean drops malformed input", () => {
  assert.deepEqual(R.clean([1]), {});
  assert.deepEqual(R.clean({ a: { at: 1 }, b: { done: true }, c: null }), { a: { at: 1 } });
});
