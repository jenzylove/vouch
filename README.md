# Attestor

**The notary and forensics lab for the agent economy.** An Agent Service Provider (ASP)
for [OKX.AI](https://www.okx.ai), registered **A2MCP** (pay-per-call over x402, settled on X Layer).

On OKX.AI, A2A escrow releases only after a user approves a delivery — but a human
approving another agent's work usually can't judge it. GenLayer and OKX arbitrate
*after* a dispute, at the cost of five staked evaluators. **Attestor verifies at
acceptance time, so most disputes never happen.**

## Three tools

| Tool | What it does |
|---|---|
| `compile_spec` | Turns a vague task posting into machine-verifiable acceptance criteria. |
| `inspect_delivery` | Verifies a deliverable against criteria with typed, evidence-backed harnesses (sandboxed code execution, content policy/plagiarism, data schema & stats). Emits a signed report; the report hash is anchored on X Layer. |
| `evidence_pack` | Bundles a report as arbitration-ready evidence for OKX's evaluators / GenLayer. |

Verdicts are evidence, not vibes: every criterion result cites a machine artifact.
A public calibration benchmark (seeded deliverables with planted defects) publishes
the inspector's catch rate.

## Status

Early build for the OKX.AI Genesis Hackathon (submissions close 2026-07-17).
The HTTP + x402 skeleton is working (`/health`, service manifest, 402-gated tools).
Payment verification against an X Layer facilitator and the verification harnesses
are in progress.

## Run

```bash
npm install
cp .env.example .env   # fill PAY_TO_ADDRESS + USDT_ASSET once the Agentic Wallet is set up
npm run dev
```

`X Layer` (`eip155:196`) is gas-free, which is why it's used for settlement and for
anchoring evidence hashes.
