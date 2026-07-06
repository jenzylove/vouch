// Unit test for anchor.ts's error-handling paths. Does NOT hit the real chain
// (the happy path was verified manually against real X Layer transactions --
// see git history / memory notes -- automated tests shouldn't spam real
// on-chain transactions on every run). This only exercises graceful
// degradation when the CLI is missing or misconfigured.
// Run: node --import tsx test/anchor.test.mjs
process.env.ONCHAINOS_BIN = "/definitely/not/a/real/binary/onchainos";
const { anchorHash, AnchoringUnavailableError } = await import("../src/anchor.ts");

let pass = 0, fail = 0;
const ok = (name, cond) => { (cond ? pass++ : fail++); console.log(`  [${cond ? "PASS" : "FAIL"}] ${name}`); };

// No wallet address configured -> fails fast without even trying the CLI.
try {
  await anchorHash("abc123", "");
  ok("throws AnchoringUnavailableError when wallet address is empty", false);
} catch (e) {
  ok("throws AnchoringUnavailableError when wallet address is empty", e instanceof AnchoringUnavailableError);
}

// Binary genuinely missing (ENOENT) -> AnchoringUnavailableError, not a generic Error.
try {
  await anchorHash("abc123", "0xf22700698c503be7dfdeaaacc2e4e41c767c263b");
  ok("throws AnchoringUnavailableError when binary is missing (ENOENT)", false);
} catch (e) {
  ok("throws AnchoringUnavailableError when binary is missing (ENOENT)", e instanceof AnchoringUnavailableError);
}

console.log(`\nanchor error-handling: ${pass} passed, ${fail} failed`);
process.exitCode = fail === 0 ? 0 : 1;
