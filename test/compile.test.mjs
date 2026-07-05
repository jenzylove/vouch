// Unit test for parseCriteria (the validation gate that keeps compile_spec output
// runnable). No API key needed. Run: node --import tsx test/compile.test.mjs
import { parseCriteria } from "../src/compile.ts";

let pass = 0, fail = 0;
const ok = (name, cond) => { (cond ? pass++ : fail++); console.log(`  [${cond ? "PASS" : "FAIL"}] ${name}`); };
const throws = (name, fn) => { try { fn(); ok(name, false); } catch { ok(name, true); } };

// Valid data criteria round-trip into typed checks.
const data = parseCriteria([
  { id: "c1", description: "has price column", check: { kind: "columns_present", columns: ["price"] } },
  { id: "c2", description: "price in range", check: { kind: "numeric_range", column: "price", min: 0, max: 100 } },
], "data");
ok("valid data criteria parse", data.length === 2 && data[1].check.kind === "numeric_range");

// Valid content criteria.
const content = parseCriteria([
  { id: "c1", description: "no placeholders", check: { kind: "no_placeholders" } },
  { id: "c2", description: "mentions refund", check: { kind: "must_include", phrases: ["refund"], mode: "all" } },
], "content");
ok("valid content criteria parse", content.length === 2 && content[1].check.kind === "must_include");

// Type applicability is enforced.
throws("content check rejected under data type", () =>
  parseCriteria([{ id: "c1", description: "x", check: { kind: "must_include", phrases: ["a"] } }], "data"));
throws("data check rejected under content type", () =>
  parseCriteria([{ id: "c1", description: "x", check: { kind: "no_nulls", columns: ["a"] } }], "content"));

// Bad shapes are rejected.
throws("unknown kind rejected", () =>
  parseCriteria([{ id: "c1", description: "x", check: { kind: "made_up" } }], "data"));
throws("missing params rejected", () =>
  parseCriteria([{ id: "c1", description: "x", check: { kind: "row_count_min" } }], "data"));
throws("wrong param type rejected", () =>
  parseCriteria([{ id: "c1", description: "x", check: { kind: "row_count_min", min: "ten" } }], "data"));
throws("numeric_range with no bounds rejected", () =>
  parseCriteria([{ id: "c1", description: "x", check: { kind: "numeric_range", column: "p" } }], "data"));
throws("non-array input rejected", () => parseCriteria({ nope: true }, "data"));

console.log(`\ncompile parseCriteria: ${pass} passed, ${fail} failed`);
process.exitCode = fail === 0 ? 0 : 1;
