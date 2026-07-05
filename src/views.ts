// Human-facing HTML rendering. Kept separate from server.ts routing so the
// report JSON shape (the thing agents/APIs actually consume) stays the
// canonical source of truth — this file only formats it for a browser.
import type { Report, CriterionResult, Evidence } from "./report.js";
import type { CalibrationReport } from "./calibration/run.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function evidenceLine(e: Evidence): string {
  return `<li><code>${esc(e.kind)}</code> — ${esc(e.detail)}</li>`;
}

function criterionRow(r: CriterionResult): string {
  const cls = r.status === "pass" ? "pass" : r.status === "fail" ? "fail" : "error";
  const icon = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "!";
  return `
  <div class="criterion ${cls}">
    <div class="crow">
      <span class="chip ${cls}">${icon} ${r.status}</span>
      <span class="cdesc">${esc(r.description)}</span>
    </div>
    <ul class="evidence">${r.evidence.map(evidenceLine).join("")}</ul>
  </div>`;
}

export function renderReportHtml(report: Report, baseUrl: string): string {
  const verdictClass = report.verdict === "pass" ? "pass" : "fail";
  const badgeUrl = `${baseUrl}/badge/${report.id}.svg`;
  const shareUrl = `${baseUrl}/r/${report.id}`;
  const embedSnippet = `<a href="${shareUrl}"><img src="${badgeUrl}" alt="Vouch report"></a>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vouch report ${esc(report.id.slice(0, 8))}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.5; }
  header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; flex-wrap: wrap; gap: 8px; }
  h1 { font-size: 1.4rem; margin: 0; }
  .verdict { font-size: 1.1rem; font-weight: 700; padding: 3px 12px; border-radius: 6px; }
  .verdict.pass { background: #d7f5df; color: #16632f; }
  .verdict.fail { background: #fbdadd; color: #8e1420; }
  @media (prefers-color-scheme: dark) {
    .verdict.pass { background: #113c20; color: #6fdc93; }
    .verdict.fail { background: #3d1418; color: #ff9aa2; }
  }
  .meta { color: #666; font-size: 0.85rem; margin-bottom: 24px; }
  .score { display: flex; gap: 16px; margin: 16px 0 28px; }
  .score div { text-align: center; }
  .score .n { font-size: 1.3rem; font-weight: 700; display: block; }
  .criterion { border: 1px solid rgba(127,127,127,.25); border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; }
  .crow { display: flex; align-items: center; gap: 10px; }
  .chip { font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 5px; text-transform: uppercase; }
  .chip.pass { background: #d7f5df; color: #16632f; }
  .chip.fail { background: #fbdadd; color: #8e1420; }
  .chip.error { background: #fdf0d5; color: #8a5a00; }
  @media (prefers-color-scheme: dark) {
    .chip.pass { background: #113c20; color: #6fdc93; }
    .chip.fail { background: #3d1418; color: #ff9aa2; }
    .chip.error { background: #3a2c08; color: #f2c14e; }
  }
  .cdesc { font-weight: 600; }
  .evidence { margin: 8px 0 0; padding-left: 20px; font-size: 0.9rem; color: #666; }
  .evidence code { background: rgba(127,127,127,.15); padding: 1px 5px; border-radius: 4px; }
  section { margin-top: 28px; }
  h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.04em; color: #888; margin-bottom: 10px; }
  .forensics ul { padding-left: 20px; font-size: 0.9rem; }
  .integrity { font-size: 0.8rem; color: #666; word-break: break-all; }
  .embed { background: rgba(127,127,127,.1); border-radius: 8px; padding: 12px 16px; font-size: 0.85rem; }
  .embed pre { white-space: pre-wrap; word-break: break-all; margin: 6px 0 0; }
  a { color: inherit; }
</style>
</head>
<body>
  <header>
    <h1>Vouch report</h1>
    <span class="verdict ${verdictClass}">${report.verdict === "pass" ? "✓ PASS" : "✗ FAIL"}</span>
  </header>
  <div class="meta">
    ${esc(report.id)} · ${esc(report.deliverableType)} deliverable · ${new Date(report.createdAt).toLocaleString()}
  </div>

  <div class="score">
    <div><span class="n">${report.score.passed}</span>passed</div>
    <div><span class="n">${report.score.failed}</span>failed</div>
    <div><span class="n">${report.score.errored}</span>errored</div>
    <div><span class="n">${report.score.total}</span>total</div>
  </div>

  <section>
    <h2>Criteria</h2>
    ${report.results.map(criterionRow).join("")}
  </section>

  <section class="forensics">
    <h2>Forensics</h2>
    <ul>${report.forensics.map(evidenceLine).join("")}</ul>
  </section>

  <section>
    <h2>Embed this verdict</h2>
    <div class="embed">
      <img src="${badgeUrl}" alt="Vouch report">
      <pre>${esc(embedSnippet)}</pre>
    </div>
  </section>

  <section>
    <h2>Integrity</h2>
    <div class="integrity">
      SHA-256: ${esc(report.reportSha256)}<br>
      Signature (ed25519): ${esc(report.signature.slice(0, 32))}…<br>
      ${report.anchor ? `Anchored on ${esc(report.anchor.chain)}: ${esc(report.anchor.txHash)}` : "Not yet anchored on-chain."}
    </div>
  </section>
</body>
</html>`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function renderCalibrationHtml(cal: CalibrationReport): string {
  const s = cal.summary;
  const allGreen = s.catchRate === 1 && s.falsePositiveRate === 0;
  const fixtureBlocks = cal.fixtures.map((f) => {
    const cls = f.allCorrect ? "ok" : "bad";
    const rows = f.criteria.map((c) => {
      const rowCls = c.correct ? "ok" : "bad";
      return `<tr class="${rowCls}"><td>${esc(c.description)}</td><td>${esc(c.expected)}</td><td>${esc(c.actual)}</td><td>${c.correct ? "✓" : "✗ MISCALIBRATED"}</td></tr>`;
    }).join("");
    return `
  <div class="fixture ${cls}">
    <div class="fhead"><strong>${esc(f.label)}</strong> <span class="ftype">${esc(f.type)}</span></div>
    <div class="fnote">${esc(f.note)}</div>
    <table><thead><tr><th>Criterion</th><th>Expected</th><th>Actual</th><th></th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vouch calibration benchmark</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px 60px; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 4px; }
  .sub { color: #777; margin-bottom: 24px; }
  .summary { display: flex; gap: 20px; flex-wrap: wrap; border: 1px solid rgba(127,127,127,.28); border-radius: 10px; padding: 18px 22px; margin-bottom: 28px; }
  .summary div { text-align: center; }
  .summary .n { display: block; font-size: 1.4rem; font-weight: 700; }
  .headline { font-weight: 700; padding: 10px 16px; border-radius: 8px; margin-bottom: 24px; }
  .headline.ok { background: #d7f5df; color: #16632f; }
  .headline.bad { background: #fbdadd; color: #8e1420; }
  @media (prefers-color-scheme: dark) {
    .headline.ok { background: #113c20; color: #6fdc93; }
    .headline.bad { background: #3d1418; color: #ff9aa2; }
  }
  .fixture { border: 1px solid rgba(127,127,127,.25); border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; }
  .fixture.bad { border-color: var(--fail, #d1242f); }
  .fhead { display: flex; justify-content: space-between; }
  .ftype { font-size: 0.75rem; text-transform: uppercase; color: #888; }
  .fnote { font-size: 0.85rem; color: #888; margin: 2px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { text-align: left; color: #888; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; padding: 4px 6px; }
  td { padding: 4px 6px; border-top: 1px solid rgba(127,127,127,.15); }
  tr.bad td { color: #d1242f; font-weight: 600; }
</style>
</head>
<body>
  <h1>Vouch calibration benchmark</h1>
  <p class="sub">Recomputed on every request — no caching, no cherry-picking. Generated ${new Date(cal.generatedAt).toLocaleString()}.</p>

  <div class="headline ${allGreen ? "ok" : "bad"}">
    ${allGreen ? "✓ 100% catch rate, 0% false positives" : "⚠ calibration drift detected — see flagged rows below"}
  </div>

  <div class="summary">
    <div><span class="n">${cal.summary.fixtureCount}</span>seeded fixtures</div>
    <div><span class="n">${cal.summary.criteriaChecked}</span>criteria checked</div>
    <div><span class="n">${pct(s.catchRate)}</span>catch rate (${s.caughtFailures}/${s.expectedFailures} planted defects)</div>
    <div><span class="n">${pct(s.falsePositiveRate)}</span>false-positive rate (${s.falsePositives}/${s.expectedPasses} clean checks)</div>
    <div><span class="n">${pct(s.accuracy)}</span>overall accuracy</div>
  </div>

  ${fixtureBlocks}
</body>
</html>`;
}
