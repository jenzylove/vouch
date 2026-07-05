// Content-harness smoke test. A marketing blurb with planted defects: a banned
// phrase, a missing required term, a leftover placeholder, no AI disclosure, and a
// duplicated paragraph. Expect verdict=fail with located evidence for each.
const BASE = process.env.BASE ?? "http://localhost:8787";

const deliverable = {
  format: "markdown",
  content: [
    "Welcome to our premium crypto fund. We offer guaranteed returns on every deposit, no questions asked.",
    "",
    "Our team has decades of combined experience across traditional finance and decentralized protocols.",
    "",
    "Our team has decades of combined experience across traditional finance and decentralized protocols.",
    "",
    "Sign up before [insert date] to lock in the early-bird rate and start earning today.",
  ].join("\n"),
};

const criteria = [
  { id: "c1", description: "Mentions the refund policy", check: { kind: "must_include", phrases: ["refund policy"], mode: "all" } },
  { id: "c2", description: "No 'guaranteed returns' claim", check: { kind: "must_not_include", phrases: ["guaranteed returns"] } },
  { id: "c3", description: "No leftover placeholders", check: { kind: "no_placeholders" } },
  { id: "c4", description: "Discloses AI generation", check: { kind: "ai_disclosure_present" } },
  { id: "c5", description: "No duplicated paragraphs", check: { kind: "no_duplicate_paragraphs" } },
  { id: "c6", description: "At least 20 words", check: { kind: "min_words", min: 20 } },
];

const r = await fetch(`${BASE}/inspect_delivery`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "content", deliverable, criteria }),
});
const report = await r.json();

console.log(`HTTP ${r.status}  verdict=${report.verdict}  score=${JSON.stringify(report.score)}`);
for (const res of report.results) {
  console.log(`  [${res.status.toUpperCase().padEnd(4)}] ${res.description}  ::  ${res.evidence.map((e) => e.detail).join("; ")}`);
}
console.log("  forensics:", report.forensics.map((f) => `${f.kind}=${f.detail}`).join(" | "));

const v = await (await fetch(`${BASE}/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(report) })).json();
const ok = report.verdict === "fail" && report.score.failed === 5 && report.score.passed === 1 && v.ok === true;
console.log(`  verify: ${JSON.stringify(v)}`);
console.log(ok ? "\nCONTENT SMOKE: PASS ✅" : "\nCONTENT SMOKE: FAIL ❌");
process.exitCode = ok ? 0 : 1; // natural drain — see note in smoke.mjs
