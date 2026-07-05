// Asserts the calibration benchmark itself is green: 100% catch rate on planted
// defects, 0% false positives on clean fixtures. This is the test that keeps us
// honest — if a harness change ever regresses accuracy, this fails loudly.
// Run: node --import tsx test/calibration.test.mjs
import { runCalibration } from "../src/calibration/run.ts";

const cal = runCalibration();
const { summary } = cal;

console.log(`Fixtures: ${summary.fixtureCount}  Criteria checked: ${summary.criteriaChecked}`);
console.log(`Catch rate: ${(summary.catchRate * 100).toFixed(1)}% (${summary.caughtFailures}/${summary.expectedFailures})`);
console.log(`False-positive rate: ${(summary.falsePositiveRate * 100).toFixed(1)}% (${summary.falsePositives}/${summary.expectedPasses})`);
console.log(`Overall accuracy: ${(summary.accuracy * 100).toFixed(1)}%`);

const miscalibrated = cal.fixtures.filter((f) => !f.allCorrect);
if (miscalibrated.length > 0) {
  console.log("\nMiscalibrated fixtures:");
  for (const f of miscalibrated) {
    for (const c of f.criteria.filter((c) => !c.correct)) {
      console.log(`  [${f.id}] ${c.description}: expected ${c.expected}, got ${c.actual}`);
    }
  }
}

const ok = summary.catchRate === 1 && summary.falsePositiveRate === 0;
console.log(ok ? "\nCALIBRATION: PASS ✅" : "\nCALIBRATION: FAIL ❌");
process.exitCode = ok ? 0 : 1;
