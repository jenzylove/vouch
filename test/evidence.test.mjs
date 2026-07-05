// Unit test for buildEvidencePack — pure, no server or network needed.
// Run: node --import tsx test/evidence.test.mjs
import { buildEvidencePack } from "../src/evidence.ts";

let pass = 0, fail = 0;
const ok = (name, cond) => { (cond ? pass++ : fail++); console.log(`  [${cond ? "PASS" : "FAIL"}] ${name}`); };

const fakeReport = {
  id: "11111111-1111-1111-1111-111111111111",
  createdAt: new Date().toISOString(),
  tool: "inspect_delivery",
  deliverableType: "data",
  deliverableSha256: "abc123",
  criteriaSha256: "def456",
  results: [
    { criterionId: "c1", description: "sku is unique", status: "fail", evidence: [{ kind: "duplicates_found", detail: "1 duplicate(s); first: A1" }] },
    { criterionId: "c2", description: "has columns", status: "pass", evidence: [{ kind: "columns_present", detail: "all present" }] },
  ],
  forensics: [],
  score: { passed: 1, failed: 1, errored: 0, total: 2 },
  verdict: "fail",
  reportSha256: "feedface",
  algorithm: "ed25519",
  signature: "sig-hex",
  signerPublicKey: "pubkey-b64",
  anchor: null,
};

const pack = buildEvidencePack(fakeReport, "https://vouch.example", "Provider claims sku column was never required.");

ok("format tag is correct", pack.format === "vouch-evidence-pack-v1");
ok("carries the report id", pack.reportId === fakeReport.id);
ok("report URL points at /r/:id", pack.reportUrl === "https://vouch.example/r/11111111-1111-1111-1111-111111111111");
ok("calibration URL present", pack.calibrationUrl === "https://vouch.example/calibration");
ok("verify instructions mention /verify", pack.verifyInstructions.includes("/verify"));
ok("dispute context is carried through", pack.disputeContext === "Provider claims sku column was never required.");
ok("brief mentions the verdict", pack.brief.includes("FAIL"));
ok("brief narrates the failed criterion with evidence", pack.brief.includes("sku is unique") && pack.brief.includes("duplicate"));
ok("brief narrates the passed criterion too", pack.brief.includes("has columns"));
ok("brief includes the dispute context verbatim", pack.brief.includes("Provider claims sku column was never required."));
ok("original report is embedded verbatim (signature untouched)", pack.report.signature === "sig-hex" && pack.report.reportSha256 === "feedface");

const packNoContext = buildEvidencePack(fakeReport, "https://vouch.example");
ok("disputeContext defaults to null when omitted", packNoContext.disputeContext === null);
ok("brief omits the dispute-context line when none given", !packNoContext.brief.includes("Dispute context supplied"));

console.log(`\nevidence_pack: ${pass} passed, ${fail} failed`);
process.exitCode = fail === 0 ? 0 : 1;
