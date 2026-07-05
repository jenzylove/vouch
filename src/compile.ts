// compile_spec: turn a vague task description into concrete, machine-checkable
// acceptance criteria drawn from the harness check catalog. The LLM proposes; we
// VALIDATE every criterion against the catalog before trusting it — so the output
// is always something a harness can actually run, never free-form "vibes".
//
// parseCriteria() is pure and unit-tested; compileSpec() adds the Claude call and
// needs ANTHROPIC_API_KEY (throws LlmNotConfiguredError if absent).
import Anthropic from "@anthropic-ai/sdk";
import type { Check, Criterion } from "./harness/types.js";

export class LlmNotConfiguredError extends Error {
  constructor(msg = "ANTHROPIC_API_KEY is not set") {
    super(msg);
    this.name = "LlmNotConfiguredError";
  }
}

export type DeliverableType = "data" | "content" | "code";

const DATA_KINDS = ["columns_present", "row_count_min", "row_count_max", "no_nulls", "unique", "numeric", "numeric_range"] as const;
const CONTENT_KINDS = ["must_include", "must_not_include", "min_words", "max_words", "no_placeholders", "ai_disclosure_present", "no_duplicate_paragraphs"] as const;
const CODE_KINDS = ["syntax_valid", "tests_pass", "no_banned_imports"] as const;
const KINDS_BY_TYPE: Record<DeliverableType, readonly string[]> = { data: DATA_KINDS, content: CONTENT_KINDS, code: CODE_KINDS };

const CATALOG: Record<string, string> = {
  columns_present: "columns_present {columns:string[]} — the deliverable has these columns",
  row_count_min: "row_count_min {min:number} — at least N data rows",
  row_count_max: "row_count_max {max:number} — at most N data rows",
  no_nulls: "no_nulls {columns:string[]} — no empty cells in these columns",
  unique: "unique {columns:string[]} — this column (combination) is unique per row",
  numeric: "numeric {column:string} — every value in the column parses as a number",
  numeric_range: "numeric_range {column:string, min?:number, max?:number} — values within bounds",
  must_include: "must_include {phrases:string[], mode?:'all'|'any'} — required phrases appear",
  must_not_include: "must_not_include {phrases:string[]} — banned phrases do not appear",
  min_words: "min_words {min:number} — at least N words",
  max_words: "max_words {max:number} — at most N words",
  no_placeholders: "no_placeholders {} — no lorem ipsum / TODO / [insert…] left in",
  ai_disclosure_present: "ai_disclosure_present {} — an AI-generation disclosure phrase appears",
  no_duplicate_paragraphs: "no_duplicate_paragraphs {} — no repeated paragraphs",
  syntax_valid: "syntax_valid {} — the Python code compiles without a syntax error",
  tests_pass: "tests_pass {testCode:string} — a Python test script (run against the deliverable) exits 0",
  no_banned_imports: "no_banned_imports {modules:string[]} — none of these modules are imported",
};

function buildSystem(type: DeliverableType): string {
  const list = KINDS_BY_TYPE[type].map((k) => `- ${CATALOG[k]}`).join("\n");
  return [
    `You are Vouch's spec compiler. Turn a task description for a ${type} deliverable into a`,
    `small set of concrete, independently checkable acceptance criteria.`,
    ``,
    `Use ONLY these check kinds (params in braces):`,
    list,
    ``,
    `Rules:`,
    `- Each criterion has a short human "description" and a "check" object: a "kind" from the list plus its params.`,
    `- Emit 3–8 high-signal criteria. Only what the task actually implies — do not pad.`,
    `- Never invent kinds or params outside the catalog.`,
    `- Number ids c1, c2, c3, … in order.`,
  ].join("\n");
}

// JSON schema for structured output. `check` is a permissive superset of all param
// fields; parseCriteria narrows it to a valid typed Check per kind.
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["criteria"],
  properties: {
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "description", "check"],
        properties: {
          id: { type: "string" },
          description: { type: "string" },
          check: {
            type: "object",
            additionalProperties: false,
            required: ["kind"],
            properties: {
              kind: { type: "string" },
              columns: { type: "array", items: { type: "string" } },
              column: { type: "string" },
              min: { type: "number" },
              max: { type: "number" },
              phrases: { type: "array", items: { type: "string" } },
              mode: { type: "string", enum: ["all", "any"] },
              testCode: { type: "string" },
              modules: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  },
} as const;

type RawCheck = Record<string, unknown>;

function toCheck(c: RawCheck, i: number): Check {
  const k = String(c.kind);
  const strArr = (f: string): string[] => {
    const v = c[f];
    if (!Array.isArray(v) || v.length === 0 || !v.every((x) => typeof x === "string")) {
      throw new Error(`criterion[${i}] ${k}.${f} must be a non-empty string[]`);
    }
    return v as string[];
  };
  const num = (f: string): number => {
    const v = c[f];
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`criterion[${i}] ${k}.${f} must be a number`);
    return v;
  };
  const str = (f: string): string => {
    const v = c[f];
    if (typeof v !== "string" || v.length === 0) throw new Error(`criterion[${i}] ${k}.${f} must be a string`);
    return v;
  };
  const optNum = (f: string): number | undefined => (c[f] === undefined ? undefined : num(f));

  switch (k) {
    case "columns_present": return { kind: k, columns: strArr("columns") };
    case "no_nulls": return { kind: k, columns: strArr("columns") };
    case "unique": return { kind: k, columns: strArr("columns") };
    case "row_count_min": return { kind: k, min: num("min") };
    case "row_count_max": return { kind: k, max: num("max") };
    case "numeric": return { kind: k, column: str("column") };
    case "numeric_range": {
      const min = optNum("min");
      const max = optNum("max");
      if (min === undefined && max === undefined) throw new Error(`criterion[${i}] numeric_range needs min and/or max`);
      return { kind: k, column: str("column"), min, max };
    }
    case "must_include": {
      const mode = c.mode === "any" ? "any" : c.mode === "all" ? "all" : undefined;
      return mode ? { kind: k, phrases: strArr("phrases"), mode } : { kind: k, phrases: strArr("phrases") };
    }
    case "must_not_include": return { kind: k, phrases: strArr("phrases") };
    case "min_words": return { kind: k, min: num("min") };
    case "max_words": return { kind: k, max: num("max") };
    case "no_placeholders": return { kind: k };
    case "ai_disclosure_present": return { kind: k };
    case "no_duplicate_paragraphs": return { kind: k };
    case "syntax_valid": return { kind: k };
    case "tests_pass": return { kind: k, testCode: str("testCode") };
    case "no_banned_imports": return { kind: k, modules: strArr("modules") };
    default: throw new Error(`criterion[${i}] unknown check kind '${k}'`);
  }
}

// Validate raw LLM output into typed Criteria, enforcing type applicability.
export function parseCriteria(raw: unknown, type: DeliverableType): Criterion[] {
  if (!Array.isArray(raw)) throw new Error("criteria must be an array");
  const allowed = new Set(KINDS_BY_TYPE[type]);
  return raw.map((item, i) => {
    const o = item as Record<string, unknown>;
    if (typeof o?.id !== "string" || typeof o?.description !== "string" || typeof o?.check !== "object" || o.check === null) {
      throw new Error(`criterion[${i}] must have string id, string description, and a check object`);
    }
    const rawCheck = o.check as RawCheck;
    if (!allowed.has(String(rawCheck.kind))) {
      throw new Error(`criterion[${i}] uses '${String(rawCheck.kind)}', not a valid ${type} check`);
    }
    return { id: o.id, description: o.description, check: toCheck(rawCheck, i) };
  });
}

export async function compileSpec(spec: string, type: DeliverableType): Promise<Criterion[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new LlmNotConfiguredError();
  const client = new Anthropic();
  // Cast: output_config is the canonical structured-output param but may lag in
  // this SDK version's static types; the wire contract is stable.
  const resp = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: buildSystem(type),
    messages: [{ role: "user", content: spec }],
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as Anthropic.MessageCreateParamsNonStreaming);

  const textBlock = resp.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  let parsed: { criteria?: unknown };
  try {
    parsed = JSON.parse(text) as { criteria?: unknown };
  } catch {
    throw new Error("model did not return valid JSON");
  }
  return parseCriteria(parsed.criteria, type);
}
