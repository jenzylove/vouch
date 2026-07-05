// Live smoke test for the code harness. Unlike the other smoke tests, this one
// makes real Anthropic API calls (Claude's sandboxed code_execution tool) — it
// costs a little and is slower, so it's kept deliberately small. Needs a live
// server with ANTHROPIC_API_KEY set. Run:
//   ALLOW_UNPAID=1 node --env-file=.env --import tsx src/server.ts &
//   node test/smoke-code.mjs
const BASE = process.env.BASE ?? "http://localhost:8787";

const GOOD_CODE = "def add(a, b):\n    return a + b\n";
const BUGGY_CODE = "def add(a, b):\n    return a - b\n";
const BROKEN_SYNTAX = "def add(a, b)\n    return a + b\n";
const TEST_CODE = "from solution import add\nassert add(2, 3) == 5, 'add(2,3) should be 5'\nprint('ok')\n";

async function inspect(content, criteria) {
  const r = await fetch(`${BASE}/inspect_delivery`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "code", deliverable: { format: "python", content }, criteria }),
  });
  return { status: r.status, body: await r.json() };
}

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { (cond ? pass++ : fail++); console.log(`  [${cond ? "PASS" : "FAIL"}] ${name}${extra ? " :: " + extra : ""}`); };

console.log("Running live checks against Claude's sandboxed code_execution tool (this costs real API calls)...\n");

// 1. syntax_valid on clean code
{
  const { body } = await inspect(GOOD_CODE, [{ id: "c1", description: "compiles", check: { kind: "syntax_valid" } }]);
  ok("syntax_valid: clean code passes", body.results?.[0]?.status === "pass", body.results?.[0]?.evidence?.[0]?.detail);
}

// 2. syntax_valid on broken code
{
  const { body } = await inspect(BROKEN_SYNTAX, [{ id: "c1", description: "compiles", check: { kind: "syntax_valid" } }]);
  ok("syntax_valid: broken syntax fails", body.results?.[0]?.status === "fail", body.results?.[0]?.evidence?.[0]?.detail);
}

// 3. tests_pass on correct implementation
{
  const { body } = await inspect(GOOD_CODE, [{ id: "c1", description: "add works", check: { kind: "tests_pass", testCode: TEST_CODE } }]);
  ok("tests_pass: correct add() passes", body.results?.[0]?.status === "pass", body.results?.[0]?.evidence?.[0]?.detail);
}

// 4. tests_pass on buggy implementation
{
  const { body } = await inspect(BUGGY_CODE, [{ id: "c1", description: "add works", check: { kind: "tests_pass", testCode: TEST_CODE } }]);
  ok("tests_pass: buggy add() (a-b) fails", body.results?.[0]?.status === "fail", body.results?.[0]?.evidence?.[0]?.detail);
}

// 5. no_banned_imports — clean
{
  const { body } = await inspect(GOOD_CODE, [{ id: "c1", description: "no os import", check: { kind: "no_banned_imports", modules: ["os", "subprocess"] } }]);
  ok("no_banned_imports: clean code passes", body.results?.[0]?.status === "pass");
}

// 6. no_banned_imports — violation (no LLM call needed, pure regex, but exercised via the API)
{
  const { body } = await inspect("import os\nprint(os.getcwd())\n", [{ id: "c1", description: "no os import", check: { kind: "no_banned_imports", modules: ["os"] } }]);
  ok("no_banned_imports: banned import caught", body.results?.[0]?.status === "fail", body.results?.[0]?.evidence?.[0]?.detail);
}

console.log(`\ncode harness: ${pass} passed, ${fail} failed`);
process.exitCode = fail === 0 ? 0 : 1;
