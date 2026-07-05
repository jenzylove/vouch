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
| `inspect_delivery` | Verifies a deliverable against criteria with typed, evidence-backed harnesses (data schema & stats, content policy checks, Python code execution). Emits a signed, reproducible report; the report hash is anchored on X Layer. |
| `evidence_pack` | Bundles a report as arbitration-ready evidence for OKX's evaluators / GenLayer — an unaltered, independently verifiable report plus a plain-English arbitration brief. |

Verdicts are evidence, not vibes: every criterion result cites a machine artifact,
and the report can be independently re-verified (`/verify`) or re-run from the
same criteria. The **[calibration benchmark](/calibration)** — 23 seeded
deliverables with known, hand-planted defects, re-run fresh on every request —
publishes the inspector's catch rate: currently **100% catch rate, 0% false
positives** across 57 individual checks. That's the answer to "is this actually
rigorous, or just another LLM judge."

## Try it

- **[/app](/app)** — paste a deliverable, get a signed verdict. No wallet, no
  other agent, no integration required — this is the cold-start bridge until
  the marketplace has real A2A traffic to verify.
- **[/calibration](/calibration)** — the reproducible proof the harnesses actually
  catch what they claim to.
- Every report gets a shareable link (`/r/:id`, renders as HTML for a browser or
  JSON for an API/agent client via content negotiation) and an embeddable
  status badge (`/badge/:id.svg`) an ASP can display on its own listing.

## Status

Build for the OKX.AI Genesis Hackathon (submissions close 2026-07-17).

- ✅ HTTP + x402 skeleton (`/health`, service manifest, 402-gated tools, X Layer eip155:196)
- ✅ `inspect_delivery` — data (CSV/JSON), content (text/markdown), and code (Python) harnesses, signed + verifiable reports
- ✅ `compile_spec` — Claude-backed, validated against the harness catalog before trust (live — needs `ANTHROPIC_API_KEY`)
- ✅ Code harness runs Python in **Claude's own sandboxed `code_execution` tool** — no local Docker, works on any deploy target, verdict comes from the sandbox's raw exit code, never Claude's prose
- ✅ Paste-in web UI (`/app`), embeddable badge (`/badge/:id.svg`), HTML report view (`/r/:id`)
- ✅ Calibration benchmark (`/calibration`) — 23 fixtures, 100% catch rate, 0% false positives (data + content only; code checks are live-tested separately in `test/smoke-code.mjs` since they cost real API calls)
- ✅ `evidence_pack` — arbitration-ready bundle (verbatim signed report + plain-English brief) for a prior report
- ✅ ASP avatar finalized (`assets/vouch-avatar.png`, 512×512, legible at 40px)
- 🚀 Deploying to Railway ([`docs/deploy-railway.md`](docs/deploy-railway.md); Vercel's read-only serverless filesystem is incompatible with the local signing key + report storage this service relies on)
- ⏳ Payment verification against an X Layer facilitator (payment gate currently a dev stub), on-chain anchoring of report hashes
- 📝 ASP registration copy drafted ahead of time in [`docs/asp-registration.md`](docs/asp-registration.md) — blocked only on a deployed URL and wallet login

## Run

```bash
npm install
cp .env.example .env   # fill PAY_TO_ADDRESS + USDT_ASSET once the Agentic Wallet is set up
npm run dev
```

Local testing without a wallet or payment: set `ALLOW_UNPAID=1`.

`X Layer` (`eip155:196`) is gas-free, which is why it's used for settlement and for
anchoring evidence hashes.
