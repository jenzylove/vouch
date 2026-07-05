// End-to-end smoke test for the inspect_delivery engine. Feeds a data deliverable
// with planted defects and checks that each is caught with evidence, the report is
// signed, retrievable, verifiable — and that tampering breaks verification.
// Run against a live server: `ALLOW_UNPAID=1 npm run dev` then `node test/smoke.mjs`.
const BASE = process.env.BASE ?? "http://localhost:8787";

const deliverable = {
  format: "csv",
  content: [
    "sku,price,name",
    "A1,9.99,Widget",
    "A2,,Gadget",          // planted: null price
    "A1,19.99,Gizmo",      // planted: duplicate sku (A1)
    "A3,99999,Doohickey",  // planted: price out of [0,1000]
    "A4,4.50,Sprocket",
  ].join("\n"),
};

const criteria = [
  { id: "c1", description: "Has sku, price, name columns", check: { kind: "columns_present", columns: ["sku", "price", "name"] } },
  { id: "c2", description: "At least 3 rows", check: { kind: "row_count_min", min: 3 } },
  { id: "c3", description: "price has no nulls", check: { kind: "no_nulls", columns: ["price"] } },
  { id: "c4", description: "sku is unique", check: { kind: "unique", columns: ["sku"] } },
  { id: "c5", description: "price within [0,1000]", check: { kind: "numeric_range", column: "price", min: 0, max: 1000 } },
];

const post = (path, body) =>
  fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const r = await post("/inspect_delivery", { type: "data", deliverable, criteria });
const report = await r.json();

console.log(`HTTP ${r.status}  verdict=${report.verdict}  score=${JSON.stringify(report.score)}`);
for (const res of report.results) {
  console.log(`  [${res.status.toUpperCase().padEnd(4)}] ${res.description}  ::  ${res.evidence.map((e) => e.detail).join("; ")}`);
}
console.log("  forensics:", report.forensics.map((f) => `${f.kind}=${f.detail}`).join(" | "));
console.log(`  reportSha256=${report.reportSha256.slice(0, 16)}…  sig=${report.signature.slice(0, 16)}…`);

const g = await fetch(`${BASE}/r/${report.id}`);
console.log(`GET /r/${report.id.slice(0, 8)}… -> HTTP ${g.status}`);

const v1 = await (await post("/verify", report)).json();
console.log("verify(untampered):", JSON.stringify(v1));

const tampered = JSON.parse(JSON.stringify(report));
tampered.results[2].status = "pass";
tampered.verdict = "pass";
const v2 = await (await post("/verify", tampered)).json();
console.log("verify(tampered flip fail→pass):", JSON.stringify(v2));

const okAll = report.verdict === "fail" && v1.ok === true && v2.ok === false;
console.log(okAll ? "\nSMOKE: PASS ✅" : "\nSMOKE: FAIL ❌");
// Set exitCode and let the event loop drain (avoids a Node/Windows libuv abort
// that fires when process.exit() runs while keep-alive sockets are still open).
process.exitCode = okAll ? 0 : 1;
