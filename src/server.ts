import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config, isConfiguredForPayment } from "./config.js";
import { requirePayment } from "./x402.js";
import { DataHarness } from "./harness/data.js";
import { ContentHarness } from "./harness/content.js";
import type { Criterion, Deliverable, Harness } from "./harness/types.js";
import {
  finalizeReport, newReportId, sha256Hex, canonicalize, tally, verifyReport,
  type ReportCore, type Report,
} from "./report.js";
import { saveReport, loadReport } from "./store.js";
import { compileSpec, LlmNotConfiguredError, type DeliverableType } from "./compile.js";
import { renderBadge } from "./badge.js";
import { renderReportHtml, renderCalibrationHtml } from "./views.js";
import { runCalibration } from "./calibration/run.js";
import { buildEvidencePack } from "./evidence.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const app = express();
app.use(express.json({ limit: "5mb" }));

// The paste-in web UI. Deliberately not payment-gated: this is how a human
// (no wallet, no other agent integrated) tries Vouch on day one — the
// cold-start bridge until the marketplace has real A2A traffic.
app.get("/app", (_req, res) => {
  res.sendFile(join(PUBLIC_DIR, "app.html"));
});

const SERVICE = {
  name: "Vouch",
  tagline: "The notary for the agent economy.",
  version: "0.1.0",
};

app.get("/health", (_req, res) => {
  res.json({ ok: true, ...SERVICE, paymentConfigured: isConfiguredForPayment() });
});

app.get("/", (_req, res) => {
  res.json({
    ...SERVICE,
    network: config.network,
    tools: [
      { name: "compile_spec", price: config.prices.compile_spec, unit: "USDT base units",
        summary: "Turn a vague task posting into machine-verifiable acceptance criteria.", status: "ready (set ANTHROPIC_API_KEY)" },
      { name: "inspect_delivery", price: config.prices.inspect_delivery, unit: "USDT base units",
        summary: "Verify a deliverable against criteria with evidence-backed harnesses; signed report.", status: "live (data + content harnesses)" },
      { name: "evidence_pack", price: config.prices.evidence_pack, unit: "USDT base units",
        summary: "Bundle a report as arbitration-ready evidence (OKX evaluators / GenLayer).", status: "live" },
    ],
    tryItYourself: `${config.publicBaseUrl}/app`,
    calibrationBenchmark: `${config.publicBaseUrl}/calibration`,
  });
});

// --- inspect_delivery: the evidence engine ----------------------------------

const harnesses: Record<string, Harness> = {
  data: new DataHarness(),
  content: new ContentHarness(),
};

app.post("/inspect_delivery", requirePayment("inspect_delivery",
  "Evidence-based verification of a deliverable against acceptance criteria."), async (req, res) => {
  const body = req.body as { type?: string; deliverable?: Deliverable; criteria?: Criterion[] } | undefined;
  const type = body?.type ?? "";
  const deliverable = body?.deliverable;
  const criteria = body?.criteria ?? [];
  const harness = harnesses[type];

  if (!harness) {
    res.status(400).json({
      error: "unsupported_type",
      supported: Object.keys(harnesses),
      message: `Deliverable type '${type || "(missing)"}' has no harness. The code harness is in progress.`,
    });
    return;
  }
  if (!deliverable?.content || !deliverable.format) {
    res.status(400).json({ error: "bad_deliverable", message: "deliverable.format and deliverable.content are required." });
    return;
  }

  try {
    const { results, forensics } = await harness.run(deliverable, criteria);
    const score = tally(results);
    const core: ReportCore = {
      id: newReportId(),
      createdAt: new Date().toISOString(),
      tool: "inspect_delivery",
      deliverableType: type,
      deliverableSha256: sha256Hex(deliverable.content),
      criteriaSha256: sha256Hex(canonicalize(criteria)),
      results,
      forensics,
      score,
      verdict: score.failed + score.errored === 0 ? "pass" : "fail",
    };
    const report = finalizeReport(core);
    saveReport(report);
    res.json({ ...report, view: `${config.publicBaseUrl}/r/${report.id}` });
  } catch (e) {
    res.status(422).json({ error: "inspection_failed", message: (e as Error).message });
  }
});

// --- compile_spec: vague task -> verifiable acceptance criteria -------------

app.post("/compile_spec", requirePayment("compile_spec",
  "Compile a task spec into machine-verifiable acceptance criteria."), async (req, res) => {
  const body = req.body as { spec?: string; deliverableType?: string } | undefined;
  const spec = body?.spec;
  const deliverableType = body?.deliverableType;
  if (typeof spec !== "string" || spec.trim().length === 0) {
    res.status(400).json({ error: "bad_spec", message: "Provide a non-empty 'spec' string." });
    return;
  }
  if (deliverableType !== "data" && deliverableType !== "content") {
    res.status(400).json({ error: "bad_deliverable_type", supported: ["data", "content"], message: "deliverableType must be 'data' or 'content'." });
    return;
  }
  try {
    const criteria = await compileSpec(spec, deliverableType as DeliverableType);
    res.json({ tool: "compile_spec", deliverableType, criteria });
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) {
      res.status(503).json({ error: "llm_not_configured", message: "compile_spec needs ANTHROPIC_API_KEY set on the server." });
      return;
    }
    res.status(422).json({ error: "compile_failed", message: (e as Error).message });
  }
});

// --- evidence_pack: arbitration-ready bundle for an existing report ---------

app.post("/evidence_pack", requirePayment("evidence_pack",
  "Arbitration-ready evidence bundle for a prior report."), (req, res) => {
  const body = req.body as { reportId?: string; disputeContext?: string } | undefined;
  const reportId = body?.reportId;
  if (typeof reportId !== "string" || reportId.trim().length === 0) {
    res.status(400).json({ error: "bad_request", message: "Provide the 'reportId' of a prior inspect_delivery report." });
    return;
  }
  const report = loadReport(reportId);
  if (!report) {
    res.status(404).json({ error: "not_found", message: `No report found for id '${reportId}'.` });
    return;
  }
  const pack = buildEvidencePack(report, config.publicBaseUrl, body?.disputeContext);
  res.json(pack);
});

// Public report view. Content-negotiated: browsers get the HTML report page,
// API/agent clients (Accept: application/json, or no Accept-html preference)
// get the raw signed JSON — same URL serves both audiences.
app.get("/r/:id", (req, res) => {
  const r = loadReport(req.params.id);
  if (!r) { res.status(404).json({ error: "not_found" }); return; }
  if (req.accepts(["html", "json"]) === "html") {
    res.type("html").send(renderReportHtml(r, config.publicBaseUrl));
    return;
  }
  res.json(r);
});

// Embeddable status badge — the distribution loop: an ASP that displays this
// on its own listing links back to the underlying report.
app.get("/badge/:id.svg", (req, res) => {
  const r = loadReport(req.params.id);
  const state = r ? (r.verdict === "pass" ? "pass" : "fail") : "unknown";
  res.type("image/svg+xml").set("Cache-Control", "no-cache").send(renderBadge(state));
});

// Public calibration benchmark: seeded deliverables with known planted defects,
// re-run fresh on every request (never cached) against the real harnesses.
// Answers "is this rigorous, or just another LLM judge" with a number anyone
// can reproduce by reading src/calibration/fixtures.ts.
app.get("/calibration", (req, res) => {
  const cal = runCalibration();
  if (req.accepts(["html", "json"]) === "html") {
    res.type("html").send(renderCalibrationHtml(cal));
    return;
  }
  res.json(cal);
});

// Anyone can verify a report's hash + signature independently.
app.post("/verify", (req, res) => {
  const report = req.body as Report | undefined;
  if (!report?.reportSha256 || !report.signature) {
    res.status(400).json({ error: "bad_report", message: "Provide a full report object to verify." });
    return;
  }
  res.json(verifyReport(report));
});

const server = app.listen(config.port, () => {
  console.log(`[vouch] listening on :${config.port}  (paymentConfigured=${isConfiguredForPayment()})`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
