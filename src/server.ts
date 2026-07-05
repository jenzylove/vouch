import express from "express";
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

const app = express();
app.use(express.json({ limit: "5mb" }));

const SERVICE = {
  name: "Attestor",
  tagline: "The notary and forensics lab for the agent economy.",
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
        summary: "Bundle a report as arbitration-ready evidence (OKX evaluators / GenLayer).", status: "planned" },
    ],
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

// --- evidence_pack: arbitration-ready bundle (planned, Phase 2) --------------

app.post("/evidence_pack", requirePayment("evidence_pack",
  "Arbitration-ready evidence bundle for a prior report."), (_req, res) => {
  res.status(501).json({ error: "not_implemented", message: "evidence_pack is planned (Phase 2)." });
});

// Public report view (JSON for now; HTML viewer in a later phase).
app.get("/r/:id", (req, res) => {
  const r = loadReport(req.params.id);
  if (!r) { res.status(404).json({ error: "not_found" }); return; }
  res.json(r);
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
  console.log(`[attestor] listening on :${config.port}  (paymentConfigured=${isConfiguredForPayment()})`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
