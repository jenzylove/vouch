// Code-deliverable harness (Python only, for now). Real execution needs real
// isolation. Rather than install Docker locally (which also wouldn't help once
// deployed — most serverless/PaaS targets don't let you run nested containers),
// this runs the deliverable inside Claude's own server-side code_execution tool:
// an Anthropic-hosted, network-isolated sandboxed container. No local sandbox to
// install or operate, and it works identically wherever Vouch itself is deployed.
//
// The verdict comes from the RAW execution result the API returns (stdout /
// stderr / return_code), never from Claude's prose summary of what happened —
// same "evidence, not vibes" rule as every other harness.
import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "node:crypto";
import type { CriterionResult, Evidence } from "../report.js";
import type { Check, Criterion, Deliverable, Harness, HarnessResult } from "./types.js";
import { LlmNotConfiguredError } from "../compile.js";

interface ExecResult {
  stdout: string;
  stderr: string;
  returnCode: number | null;
}

function uniqueDelimiter(): string {
  return `VOUCH_${randomBytes(8).toString("hex")}`;
}

// Runs one bash script inside Claude's sandboxed container and returns the
// LAST bash execution result the model's response contains — the model is
// instructed to run exactly one script, so this is normally the only one.
async function runInSandbox(script: string): Promise<ExecResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new LlmNotConfiguredError();
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2000,
    system: "You have a code_execution tool with a bash sandbox. Run EXACTLY the bash script the user gives you, verbatim, as a single bash_code_execution call. Do not modify it, do not add extra commands, do not explain — just execute it.",
    messages: [{ role: "user", content: script }],
    tools: [{ type: "code_execution_20260120", name: "code_execution" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as Anthropic.MessageCreateParamsNonStreaming);

  type ExecBlock = { type: string; content?: { type: string; stdout?: string; stderr?: string; return_code?: number } };
  const execBlocks = (resp.content as unknown as ExecBlock[]).filter((b) => b.type === "bash_code_execution_tool_result");
  const last = execBlocks.at(-1);
  if (!last?.content || last.content.type !== "bash_code_execution_result") {
    throw new Error("sandbox did not return an execution result — the model may have declined to run the script");
  }
  return { stdout: last.content.stdout ?? "", stderr: last.content.stderr ?? "", returnCode: last.content.return_code ?? null };
}

function heredocScript(deliverable: string, extra: string): string {
  const solutionDelim = uniqueDelimiter();
  const rest = extra.replace("{{SOLUTION_DELIM}}", solutionDelim);
  return `cat > solution.py << '${solutionDelim}'\n${deliverable}\n${solutionDelim}\n${rest}`;
}

async function checkSyntaxValid(deliverable: string): Promise<CriterionResult["status"]> {
  // The LAST command's exit status is what the sandbox reports as return_code —
  // it must stay last, unpiped, un-followed by anything (even `echo`) that
  // would itself succeed and silently overwrite the real exit code.
  const script = heredocScript(deliverable, "python -m py_compile solution.py");
  const result = await runInSandbox(script);
  return result.returnCode === 0 ? "pass" : "fail";
}

async function checkTestsPass(deliverable: string, testCode: string): Promise<{ status: CriterionResult["status"]; evidence: Evidence[] }> {
  const testDelim = uniqueDelimiter();
  const script = heredocScript(
    deliverable,
    `cat > test_solution.py << '${testDelim}'\n${testCode}\n${testDelim}\npython test_solution.py`,
  );
  const result = await runInSandbox(script);
  const passed = result.returnCode === 0;
  return {
    status: passed ? "pass" : "fail",
    evidence: [{
      kind: "execution",
      detail: passed ? "tests passed (exit 0)" : `tests failed (exit ${result.returnCode ?? "unknown"})`,
      data: { stdout: result.stdout.slice(0, 4000), stderr: result.stderr.slice(0, 4000), returnCode: result.returnCode },
    }],
  };
}

function checkNoBannedImports(deliverable: string, modules: string[]): { status: CriterionResult["status"]; evidence: Evidence[] } {
  const found = modules.filter((m) => {
    const re = new RegExp(`^\\s*(import\\s+${m}\\b|from\\s+${m}\\b)`, "m");
    return re.test(deliverable);
  });
  return found.length === 0
    ? { status: "pass", evidence: [{ kind: "no_banned_imports", detail: "no banned modules imported" }] }
    : { status: "fail", evidence: [{ kind: "banned_import_found", detail: `imports banned module(s): ${found.join(", ")}`, data: found }] };
}

async function evaluate(deliverable: string, check: Check): Promise<{ status: CriterionResult["status"]; evidence: Evidence[] }> {
  switch (check.kind) {
    case "syntax_valid": {
      const status = await checkSyntaxValid(deliverable);
      return { status, evidence: [{ kind: "syntax_valid", detail: status === "pass" ? "compiles cleanly" : "syntax error — see sandbox output" }] };
    }
    case "tests_pass":
      return checkTestsPass(deliverable, check.testCode);
    case "no_banned_imports":
      return checkNoBannedImports(deliverable, check.modules);
    default:
      throw new Error(`'${(check as { kind: string }).kind}' is not a code check`);
  }
}

export class CodeHarness implements Harness {
  readonly type = "code";
  async run(deliverable: Deliverable, criteria: Criterion[]): Promise<HarnessResult> {
    const results: CriterionResult[] = [];
    for (const c of criteria) {
      try {
        const { status, evidence } = await evaluate(deliverable.content, c.check);
        results.push({ criterionId: c.id, description: c.description, status, evidence });
      } catch (e) {
        results.push({ criterionId: c.id, description: c.description, status: "error", evidence: [{ kind: "error", detail: (e as Error).message }] });
      }
    }
    return {
      results,
      forensics: [{ kind: "language", detail: "Python (via Anthropic sandboxed code_execution)" }],
    };
  }
}
