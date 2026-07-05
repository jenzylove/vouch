# Vouch

**The notary for the agent economy.** An Agent Service Provider (ASP) for
[OKX.AI](https://www.okx.ai), registered **A2MCP** (pay-per-call over x402,
settled on X Layer).

## The gap

In a deal between two agents who don't trust each other, someone has to rule on
"was it done right" in a way *both sides accept* — before or instead of a dispute.

- **Not a rating/audit bot.** Any agent can ask Fable "is this good?" — but an
  opinion the *other party* didn't commission is worthless to them. Vouch's value
  is a verdict **neither party controls**, computed against criteria **both sides
  agreed to before delivery**, signed and reproducible enough to settle an argument.
- **Not escrow.** OKX's A2A escrow holds the money and releases it on approval —
  but the protocol (and ERC-8183, the emerging standard) deliberately leaves *what
  logic decides approval* undefined. Vouch fills that slot. We never touch funds.
- **Not the same as OKX's dispute arbitration / GenLayer.** Those fire *after* a
  dispute, at the cost of five staked evaluators, a bounty, and delay. Vouch verifies
  **at delivery**, so most disputes never happen — and when one does happen anyway,
  a Vouch report is the evidence the arbitrators / GenLayer's jury rule on.

## Three tools

| Tool | What it does |
|---|---|
| `compile_spec` | Turns a vague task posting into machine-verifiable acceptance criteria — the pre-agreed contract both sides check delivery against. |
| `inspect_delivery` | Verifies a deliverable against criteria with typed, evidence-backed harnesses (data schema & stats, content policy checks; code execution planned). Emits a signed, reproducible report; the report hash is anchored on X Layer. |
| `evidence_pack` | Bundles a report as arbitration-ready evidence for OKX's evaluators / GenLayer. |

Verdicts are evidence, not vibes: every criterion result cites a machine artifact,
and the report can be independently re-verified (`/verify`) or re-run from the
same criteria. A public calibration benchmark (seeded deliverables with planted
defects) publishes the inspector's catch rate — the answer to "is this actually
rigorous, or just another LLM judge."

## Status

Build for the OKX.AI Genesis Hackathon (submissions close 2026-07-17).

- ✅ HTTP + x402 skeleton (`/health`, service manifest, 402-gated tools, X Layer eip155:196)
- ✅ `inspect_delivery` — data harness (CSV/JSON) + content harness (text/markdown), signed + verifiable reports
- ✅ `compile_spec` — Claude-backed, validated against the harness catalog before trust (needs `ANTHROPIC_API_KEY`)
- ⏳ Payment verification against an X Layer facilitator (payment gate currently a dev stub)
- ⏳ Paste-in web UI, embeddable badge, calibration benchmark, code harness, on-chain anchoring

## Run

```bash
npm install
cp .env.example .env   # fill PAY_TO_ADDRESS + USDT_ASSET once the Agentic Wallet is set up
npm run dev
```

Local testing without a wallet or payment: set `ALLOW_UNPAID=1`.

`X Layer` (`eip155:196`) is gas-free, which is why it's used for settlement and for
anchoring evidence hashes.
