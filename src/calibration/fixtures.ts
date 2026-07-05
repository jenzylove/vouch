// Calibration fixtures: seeded deliverables with KNOWN, hand-placed defects (or
// deliberately none). Each fixture declares the expected pass/fail outcome for
// every criterion. Running the harnesses against these and comparing actual vs.
// expected is the answer to "is this a real checker or just another LLM judge" —
// a rating bot has no equivalent artifact, because its verdicts aren't checked
// against a ground truth.
import type { Criterion, Deliverable } from "../harness/types.js";
import type { CriterionStatus } from "../report.js";

export interface Fixture {
  id: string;
  label: string;
  note: string; // what defect (if any) is planted, in plain English
  type: "data" | "content";
  deliverable: Deliverable;
  criteria: Criterion[];
  expected: Record<string, CriterionStatus>; // criterionId -> expected status
}

const dataCriteria = {
  columns: { id: "columns", description: "Has sku, price, name columns", check: { kind: "columns_present" as const, columns: ["sku", "price", "name"] } },
  rowsMin3: { id: "rowsMin3", description: "At least 3 rows", check: { kind: "row_count_min" as const, min: 3 } },
  rowsMax5: { id: "rowsMax5", description: "At most 5 rows", check: { kind: "row_count_max" as const, max: 5 } },
  noNulls: { id: "noNulls", description: "price has no nulls", check: { kind: "no_nulls" as const, columns: ["price"] } },
  unique: { id: "unique", description: "sku is unique", check: { kind: "unique" as const, columns: ["sku"] } },
  numeric: { id: "numeric", description: "price is numeric", check: { kind: "numeric" as const, column: "price" } },
  range: { id: "range", description: "price within [0,1000]", check: { kind: "numeric_range" as const, column: "price", min: 0, max: 1000 } },
  rangeMinOnly: { id: "rangeMinOnly", description: "qty >= 0", check: { kind: "numeric_range" as const, column: "qty", min: 0 } },
  rangeMaxOnly: { id: "rangeMaxOnly", description: "qty <= 100", check: { kind: "numeric_range" as const, column: "qty", max: 100 } },
};

const DATA_FIXTURES: Fixture[] = [
  {
    id: "data-clean-1", label: "Clean product CSV", note: "no defects — every criterion should pass", type: "data",
    deliverable: { format: "csv", content: "sku,price,name\nA1,9.99,Widget\nA2,14.5,Gadget\nA3,4.0,Sprocket" },
    criteria: [dataCriteria.columns, dataCriteria.rowsMin3, dataCriteria.noNulls, dataCriteria.unique, dataCriteria.numeric, dataCriteria.range],
    expected: { columns: "pass", rowsMin3: "pass", noNulls: "pass", unique: "pass", numeric: "pass", range: "pass" },
  },
  {
    id: "data-clean-json", label: "Clean product JSON", note: "same as above but JSON format — tests the JSON parse path", type: "data",
    deliverable: { format: "json", content: JSON.stringify([{ sku: "B1", price: 5, name: "Bolt" }, { sku: "B2", price: 12, name: "Bracket" }, { sku: "B3", price: 3, name: "Bearing" }]) },
    criteria: [dataCriteria.columns, dataCriteria.rowsMin3, dataCriteria.noNulls, dataCriteria.unique, dataCriteria.numeric, dataCriteria.range],
    expected: { columns: "pass", rowsMin3: "pass", noNulls: "pass", unique: "pass", numeric: "pass", range: "pass" },
  },
  {
    id: "data-missing-column", label: "Missing required column", note: "planted: 'price' column absent", type: "data",
    deliverable: { format: "csv", content: "sku,name\nA1,Widget\nA2,Gadget\nA3,Sprocket" },
    criteria: [dataCriteria.columns, dataCriteria.rowsMin3],
    expected: { columns: "fail", rowsMin3: "pass" },
  },
  {
    id: "data-null-price", label: "Null price cell", note: "planted: one row has an empty price", type: "data",
    deliverable: { format: "csv", content: "sku,price,name\nA1,9.99,Widget\nA2,,Gadget\nA3,4.0,Sprocket" },
    criteria: [dataCriteria.noNulls, dataCriteria.columns],
    expected: { noNulls: "fail", columns: "pass" },
  },
  {
    id: "data-duplicate-sku", label: "Duplicate SKU", note: "planted: sku A1 appears twice", type: "data",
    deliverable: { format: "csv", content: "sku,price,name\nA1,9.99,Widget\nA1,14.5,Gadget\nA3,4.0,Sprocket" },
    criteria: [dataCriteria.unique, dataCriteria.rowsMin3],
    expected: { unique: "fail", rowsMin3: "pass" },
  },
  {
    id: "data-non-numeric-price", label: "Non-numeric price", note: "planted: price is the text 'N/A'", type: "data",
    deliverable: { format: "csv", content: "sku,price,name\nA1,N/A,Widget\nA2,14.5,Gadget\nA3,4.0,Sprocket" },
    criteria: [dataCriteria.numeric, dataCriteria.noNulls],
    expected: { numeric: "fail", noNulls: "pass" },
  },
  {
    id: "data-out-of-range-price", label: "Price out of range", note: "planted: one price is 99999, well above the 1000 cap", type: "data",
    deliverable: { format: "csv", content: "sku,price,name\nA1,9.99,Widget\nA2,99999,Gadget\nA3,4.0,Sprocket" },
    criteria: [dataCriteria.range, dataCriteria.numeric],
    expected: { range: "fail", numeric: "pass" },
  },
  {
    id: "data-too-few-rows", label: "Too few rows", note: "planted: only 2 rows against a minimum of 3", type: "data",
    deliverable: { format: "csv", content: "sku,price,name\nA1,9.99,Widget\nA2,14.5,Gadget" },
    criteria: [dataCriteria.rowsMin3, dataCriteria.columns],
    expected: { rowsMin3: "fail", columns: "pass" },
  },
  {
    id: "data-too-many-rows", label: "Too many rows", note: "planted: 6 rows against a maximum of 5", type: "data",
    deliverable: { format: "csv", content: "sku,price,name\nA1,1,W1\nA2,2,W2\nA3,3,W3\nA4,4,W4\nA5,5,W5\nA6,6,W6" },
    criteria: [dataCriteria.rowsMax5],
    expected: { rowsMax5: "fail" },
  },
  {
    id: "data-range-min-only", label: "Negative quantity (min-only range)", note: "planted: qty is negative, violating a min-only bound", type: "data",
    deliverable: { format: "csv", content: "sku,qty,name\nA1,-5,Widget\nA2,10,Gadget\nA3,3,Sprocket" },
    criteria: [dataCriteria.rangeMinOnly],
    expected: { rangeMinOnly: "fail" },
  },
  {
    id: "data-range-max-only", label: "Excessive quantity (max-only range)", note: "planted: qty exceeds a max-only bound", type: "data",
    deliverable: { format: "csv", content: "sku,qty,name\nA1,5,Widget\nA2,250,Gadget\nA3,3,Sprocket" },
    criteria: [dataCriteria.rangeMaxOnly],
    expected: { rangeMaxOnly: "fail" },
  },
  {
    id: "data-multi-defect", label: "Multiple simultaneous defects", note: "planted: null price AND duplicate sku AND out-of-range price, all at once", type: "data",
    deliverable: { format: "csv", content: "sku,price,name\nA1,,Widget\nA1,99999,Gadget\nA3,4.0,Sprocket" },
    criteria: [dataCriteria.noNulls, dataCriteria.unique, dataCriteria.range, dataCriteria.columns],
    expected: { noNulls: "fail", unique: "fail", range: "fail", columns: "pass" },
  },
];

const contentCriteria = {
  mustInclude: { id: "mustInclude", description: "Mentions the refund policy", check: { kind: "must_include" as const, phrases: ["refund policy"], mode: "all" as const } },
  mustIncludeAny: { id: "mustIncludeAny", description: "Mentions at least one contact method", check: { kind: "must_include" as const, phrases: ["support@example.com", "live chat"], mode: "any" as const } },
  mustNotInclude: { id: "mustNotInclude", description: "No 'guaranteed returns' claim", check: { kind: "must_not_include" as const, phrases: ["guaranteed returns"] } },
  minWords: { id: "minWords", description: "At least 20 words", check: { kind: "min_words" as const, min: 20 } },
  maxWords: { id: "maxWords", description: "At most 12 words", check: { kind: "max_words" as const, max: 12 } },
  noPlaceholders: { id: "noPlaceholders", description: "No leftover placeholders", check: { kind: "no_placeholders" as const } },
  aiDisclosure: { id: "aiDisclosure", description: "Discloses AI generation", check: { kind: "ai_disclosure_present" as const } },
  noDup: { id: "noDup", description: "No duplicated paragraphs", check: { kind: "no_duplicate_paragraphs" as const } },
};

const CONTENT_FIXTURES: Fixture[] = [
  {
    id: "content-clean-1", label: "Clean marketing blurb", note: "no defects — every criterion should pass", type: "content",
    deliverable: { format: "markdown", content: "Our fund is AI-generated content reviewed by analysts. Returns vary with market conditions and are never guaranteed. See our refund policy for details on cancellations. Contact support@example.com with questions about your account or investment strategy." },
    criteria: [contentCriteria.mustInclude, contentCriteria.mustNotInclude, contentCriteria.noPlaceholders, contentCriteria.aiDisclosure, contentCriteria.noDup, contentCriteria.minWords],
    expected: { mustInclude: "pass", mustNotInclude: "pass", noPlaceholders: "pass", aiDisclosure: "pass", noDup: "pass", minWords: "pass" },
  },
  {
    id: "content-clean-2", label: "Clean product description", note: "different topic, still no defects", type: "content",
    deliverable: { format: "markdown", content: "This is an AI-generated product description. The Widget Pro ships in three colors and includes a one-year warranty. For support, use our live chat any time." },
    criteria: [contentCriteria.mustIncludeAny, contentCriteria.aiDisclosure, contentCriteria.noPlaceholders],
    expected: { mustIncludeAny: "pass", aiDisclosure: "pass", noPlaceholders: "pass" },
  },
  {
    id: "content-missing-required-phrase", label: "Missing required phrase", note: "planted: no mention of the refund policy at all", type: "content",
    deliverable: { format: "markdown", content: "Our fund offers strong returns. Contact us anytime with questions about your account." },
    criteria: [contentCriteria.mustInclude, contentCriteria.mustNotInclude],
    expected: { mustInclude: "fail", mustNotInclude: "pass" },
  },
  {
    id: "content-banned-phrase", label: "Banned phrase present", note: "planted: the banned claim 'guaranteed returns' is used", type: "content",
    deliverable: { format: "markdown", content: "We offer guaranteed returns on every deposit, backed by our refund policy." },
    criteria: [contentCriteria.mustNotInclude, contentCriteria.mustInclude],
    expected: { mustNotInclude: "fail", mustInclude: "pass" },
  },
  {
    id: "content-placeholder", label: "Leftover placeholder text", note: "planted: an unfilled [insert date] placeholder", type: "content",
    deliverable: { format: "markdown", content: "Sign up before [insert date] to lock in the early rate. This is AI-generated content. See our refund policy for details." },
    criteria: [contentCriteria.noPlaceholders, contentCriteria.mustInclude],
    expected: { noPlaceholders: "fail", mustInclude: "pass" },
  },
  {
    id: "content-missing-disclosure", label: "Missing AI disclosure", note: "planted: no AI-generation disclosure phrase anywhere", type: "content",
    deliverable: { format: "markdown", content: "Our fund offers competitive returns. See our refund policy for details on cancellations." },
    criteria: [contentCriteria.aiDisclosure, contentCriteria.mustInclude],
    expected: { aiDisclosure: "fail", mustInclude: "pass" },
  },
  {
    id: "content-duplicate-paragraph", label: "Duplicated paragraph", note: "planted: the same paragraph repeated twice", type: "content",
    deliverable: { format: "markdown", content: "This is AI-generated content about our team.\n\nOur team has decades of combined experience across finance and technology.\n\nOur team has decades of combined experience across finance and technology." },
    criteria: [contentCriteria.noDup, contentCriteria.aiDisclosure],
    expected: { noDup: "fail", aiDisclosure: "pass" },
  },
  {
    id: "content-too-short", label: "Below minimum word count", note: "planted: far fewer than the required 20 words", type: "content",
    deliverable: { format: "markdown", content: "AI-generated. Short note only." },
    criteria: [contentCriteria.minWords],
    expected: { minWords: "fail" },
  },
  {
    id: "content-too-long", label: "Above maximum word count", note: "planted: exceeds a 12-word cap", type: "content",
    deliverable: { format: "markdown", content: "This AI-generated announcement is deliberately much longer than the twelve word limit allows for this slot." },
    criteria: [contentCriteria.maxWords],
    expected: { maxWords: "fail" },
  },
  {
    id: "content-max-words-boundary", label: "Exactly at the word-count boundary", note: "boundary case: exactly 12 words should still pass a <=12 limit", type: "content",
    deliverable: { format: "markdown", content: "one two three four five six seven eight nine ten eleven twelve" },
    criteria: [contentCriteria.maxWords],
    expected: { maxWords: "pass" },
  },
  {
    id: "content-multi-defect", label: "Multiple simultaneous defects", note: "planted: banned phrase AND missing disclosure AND a placeholder, all at once", type: "content",
    deliverable: { format: "markdown", content: "We offer guaranteed returns. Sign up before [insert date]. See our refund policy for details." },
    criteria: [contentCriteria.mustNotInclude, contentCriteria.aiDisclosure, contentCriteria.noPlaceholders, contentCriteria.mustInclude],
    expected: { mustNotInclude: "fail", aiDisclosure: "fail", noPlaceholders: "fail", mustInclude: "pass" },
  },
];

export const FIXTURES: Fixture[] = [...DATA_FIXTURES, ...CONTENT_FIXTURES];
