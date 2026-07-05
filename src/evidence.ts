// evidence_pack: repackages an existing signed report as an arbitration-ready
// bundle. Vouch never rules on a dispute itself — this is the hand-off artifact
// for whoever does (OKX's staked evaluators, or a GenLayer Intelligent Contract
// jury fetching it via verified web access). The underlying report's own
// signature is untouched and independently re-verifiable; this just adds a
// plain-English brief so a human or LLM arbitrator doesn't have to reconstruct
// the narrative from raw JSON.
import type { Report, CriterionResult } from "./report.js";

export interface EvidencePack {
  format: "vouch-evidence-pack-v1";
  generatedAt: string;
  disputeContext: string | null;
  brief: string;
  reportId: string;
  reportUrl: string;
  calibrationUrl: string;
  verifyInstructions: string;
  report: Report; // verbatim — its own hash/signature stay independently checkable
}

function narrateCriterion(c: CriterionResult): string {
  const ev = c.evidence.map((e) => e.detail).join("; ");
  return `- [${c.status.toUpperCase()}] ${c.description} — ${ev || "no evidence recorded"}`;
}

function buildBrief(report: Report, disputeContext: string | null): string {
  const failed = report.results.filter((r) => r.status !== "pass");
  const passed = report.results.filter((r) => r.status === "pass");
  const lines: string[] = [];

  lines.push(
    `Vouch inspected a "${report.deliverableType}" deliverable against ${report.results.length} ` +
    `pre-agreed acceptance criteria and reached a verdict of ${report.verdict.toUpperCase()} ` +
    `(${report.score.passed} passed, ${report.score.failed} failed, ${report.score.errored} errored).`,
  );

  if (disputeContext) {
    lines.push(`\nDispute context supplied by the requester: "${disputeContext}"`);
  }

  if (failed.length > 0) {
    lines.push(`\nCriteria NOT met:`);
    failed.forEach((c) => lines.push(narrateCriterion(c)));
  }
  if (passed.length > 0) {
    lines.push(`\nCriteria met:`);
    passed.forEach((c) => lines.push(narrateCriterion(c)));
  }

  lines.push(
    `\nThis brief is generated from evidence, not opinion: every line above traces to a ` +
    `machine-checked artifact in the attached report, which is independently verifiable ` +
    `(hash + ed25519 signature) and was produced before this dispute existed. Vouch does not ` +
    `rule on the dispute — this pack is evidence for whoever does.`,
  );

  return lines.join("\n");
}

export function buildEvidencePack(report: Report, publicBaseUrl: string, disputeContext?: string): EvidencePack {
  const ctx = disputeContext?.trim() || null;
  return {
    format: "vouch-evidence-pack-v1",
    generatedAt: new Date().toISOString(),
    disputeContext: ctx,
    brief: buildBrief(report, ctx),
    reportId: report.id,
    reportUrl: `${publicBaseUrl}/r/${report.id}`,
    calibrationUrl: `${publicBaseUrl}/calibration`,
    verifyInstructions: `POST the 'report' field of this pack to ${publicBaseUrl}/verify to independently confirm its hash and signature have not been altered.`,
    report,
  };
}
