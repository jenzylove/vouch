import express from "express";
import { config, isConfiguredForPayment } from "./config.js";
import { requirePayment } from "./x402.js";

const app = express();
app.use(express.json({ limit: "5mb" }));

const SERVICE = {
  name: "Attestor",
  tagline: "The notary and forensics lab for the agent economy.",
  version: "0.1.0",
};

// Liveness/readiness — AI judges and uptime checks hit this. Never gated.
app.get("/health", (_req, res) => {
  res.json({ ok: true, ...SERVICE, paymentConfigured: isConfiguredForPayment() });
});

// Service manifest — what this A2MCP endpoint offers and how it is priced.
app.get("/", (_req, res) => {
  res.json({
    ...SERVICE,
    network: config.network,
    tools: [
      { name: "compile_spec", price: config.prices.compile_spec, unit: "USDT base units",
        summary: "Turn a vague task posting into machine-verifiable acceptance criteria." },
      { name: "inspect_delivery", price: config.prices.inspect_delivery, unit: "USDT base units",
        summary: "Verify a deliverable against criteria with evidence-backed harnesses; signed report." },
      { name: "evidence_pack", price: config.prices.evidence_pack, unit: "USDT base units",
        summary: "Bundle a report as arbitration-ready evidence (OKX evaluators / GenLayer)." },
    ],
  });
});

// --- Paid tools (x402-gated). Handlers are Phase-1 stubs for now. ---

app.post("/compile_spec", requirePayment("compile_spec",
  "Compile a task spec into verifiable acceptance criteria."), (req, res) => {
  res.json({ tool: "compile_spec", status: "stub", received: req.body ?? null });
});

app.post("/inspect_delivery", requirePayment("inspect_delivery",
  "Evidence-based verification of a deliverable against acceptance criteria."), (req, res) => {
  res.json({ tool: "inspect_delivery", status: "stub", received: req.body ?? null });
});

app.post("/evidence_pack", requirePayment("evidence_pack",
  "Arbitration-ready evidence bundle for a prior report."), (req, res) => {
  res.json({ tool: "evidence_pack", status: "stub", received: req.body ?? null });
});

const server = app.listen(config.port, () => {
  console.log(`[attestor] listening on :${config.port}  (paymentConfigured=${isConfiguredForPayment()})`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
