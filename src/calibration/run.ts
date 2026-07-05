// Calibration runner: executes every fixture through the real harnesses (the
// same code path inspect_delivery uses) and diffs actual vs. expected per
// criterion. This is computed fresh on every request — no caching, no curated
// "best run" — because a number you can't reproduce isn't evidence, it's a claim.
import { DataHarness } from "../harness/data.js";
import { ContentHarness } from "../harness/content.js";
import type { Harness } from "../harness/types.js";
import type { CriterionStatus } from "../report.js";
import { FIXTURES, type Fixture } from "./fixtures.js";

const harnesses: Record<Fixture["type"], Harness> = {
  data: new DataHarness(),
  content: new ContentHarness(),
};

export interface CriterionCheckResult {
  criterionId: string;
  description: string;
  expected: CriterionStatus;
  actual: CriterionStatus;
  correct: boolean;
}
export interface FixtureResult {
  id: string;
  label: string;
  note: string;
  type: Fixture["type"];
  allCorrect: boolean;
  criteria: CriterionCheckResult[];
}
export interface CalibrationSummary {
  fixtureCount: number;
  fixturesFullyCorrect: number;
  criteriaChecked: number;
  criteriaCorrect: number;
  accuracy: number;         // criteriaCorrect / criteriaChecked
  expectedFailures: number; // criteria whose expected status is "fail"
  caughtFailures: number;   // of those, how many the harness also called "fail"
  catchRate: number;        // caughtFailures / expectedFailures — recall on planted defects
  expectedPasses: number;
  falsePositives: number;   // expected "pass" but harness said "fail"/"error"
  falsePositiveRate: number;
}
export interface CalibrationReport {
  generatedAt: string;
  summary: CalibrationSummary;
  fixtures: FixtureResult[];
}

export function runCalibration(): CalibrationReport {
  const fixtureResults: FixtureResult[] = FIXTURES.map((f) => {
    const harness = harnesses[f.type];
    const { results } = harness.run(f.deliverable, f.criteria) as { results: { criterionId: string; description: string; status: CriterionStatus }[] };
    const criteria: CriterionCheckResult[] = results.map((r) => {
      const expected = f.expected[r.criterionId];
      return {
        criterionId: r.criterionId,
        description: r.description,
        expected,
        actual: r.status,
        correct: r.status === expected,
      };
    });
    return { id: f.id, label: f.label, note: f.note, type: f.type, allCorrect: criteria.every((c) => c.correct), criteria };
  });

  let criteriaChecked = 0, criteriaCorrect = 0;
  let expectedFailures = 0, caughtFailures = 0;
  let expectedPasses = 0, falsePositives = 0;

  for (const fr of fixtureResults) {
    for (const c of fr.criteria) {
      criteriaChecked++;
      if (c.correct) criteriaCorrect++;
      if (c.expected === "fail") {
        expectedFailures++;
        if (c.actual === "fail") caughtFailures++;
      }
      if (c.expected === "pass") {
        expectedPasses++;
        if (c.actual !== "pass") falsePositives++;
      }
    }
  }

  const summary: CalibrationSummary = {
    fixtureCount: fixtureResults.length,
    fixturesFullyCorrect: fixtureResults.filter((f) => f.allCorrect).length,
    criteriaChecked,
    criteriaCorrect,
    accuracy: criteriaChecked ? criteriaCorrect / criteriaChecked : 0,
    expectedFailures,
    caughtFailures,
    catchRate: expectedFailures ? caughtFailures / expectedFailures : 0,
    expectedPasses,
    falsePositives,
    falsePositiveRate: expectedPasses ? falsePositives / expectedPasses : 0,
  };

  return { generatedAt: new Date().toISOString(), summary, fixtures: fixtureResults };
}
