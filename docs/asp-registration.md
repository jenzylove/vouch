# ASP registration — ready-to-paste copy

Drafted ahead of time so registering Vouch is copy-paste, not a scramble, the
moment the wallet is live and the service is deployed at a public HTTPS URL.
Field names, limits, and the flow itself come from the `okx-agent-identity`
skill (`register.md`) — run via `onchainos agent pre-check --role asp` then
`onchainos agent create`.

## Blocked on (needs you, not more code)

1. ~~Avatar image~~ — **done.** `assets/vouch-avatar.png` (512×512, opaque,
   the "Stamped Circle" concept — brass checkmark on an ink-navy ground with
   a subtle stamped-edge texture). Verified legible at 40px (actual
   marketplace-thumbnail size).
2. **A deployed public HTTPS endpoint.** Registration is permanent on-chain —
   `localhost` / private IPs are rejected outright. Deploying to Railway now
   (see [`docs/deploy-railway.md`](deploy-railway.md)); replace every
   `<deployed-domain>` below once that URL exists.
3. **Wallet login**, so the CLI has a session to sign the registration with.

## Step 1 — Identity

| Field | Value |
|---|---|
| Role | ASP |
| Name | `Vouch` |
| Description | Vouch is the notary for the agent economy: it verifies delivered work against pre-agreed acceptance criteria and issues a signed, reproducible pass/fail report — so escrow can release with confidence, and so disputes have evidence to rule on when they do happen. |
| Avatar | `assets/vouch-avatar.png` |

## Step 2 — Services

One service per priced tool, matching the three live endpoints exactly.

### Service 1 — Spec Compilation
- **Name:** `Spec Compilation`
- **Description (part 1 — capability):** Compiles a vague task description into machine-verifiable acceptance criteria that both parties can agree to before delivery.
- **Description (part 2 — what the caller provides):** 1. A plain-English description of the task 2. The deliverable type (data or content)
- **Type:** A2MCP
- **Fee:** `0.05`
- **Endpoint:** `https://<deployed-domain>/compile_spec`

### Service 2 — Deliverable Verification
- **Name:** `Deliverable Verification`
- **Description (part 1 — capability):** Verifies a delivered task against pre-agreed acceptance criteria using evidence-backed checks and returns a signed, tamper-evident pass or fail report.
- **Description (part 2 — what the caller provides):** 1. The deliverable content and its format 2. The acceptance criteria (or run Spec Compilation first)
- **Type:** A2MCP
- **Fee:** `0.25`
- **Endpoint:** `https://<deployed-domain>/inspect_delivery`

### Service 3 — Evidence Pack
- **Name:** `Evidence Pack`
- **Description (part 1 — capability):** Bundles a prior verification report into an arbitration-ready evidence pack for dispute resolution.
- **Description (part 2 — what the caller provides):** 1. The report ID from a prior Deliverable Verification call 2. Optional dispute context
- **Type:** A2MCP
- **Fee:** `0.50`
- **Endpoint:** `https://<deployed-domain>/evidence_pack`

## Notes

- Fees match `.env` (`PRICE_COMPILE_SPEC=50000`, `PRICE_INSPECT_DELIVERY=250000`,
  `PRICE_EVIDENCE_PACK=500000` base units = 0.05 / 0.25 / 0.50 USDT). Keep these
  in sync if prices change before registering.
- All three names, descriptions, and lengths were checked against the
  `register.md` rules (name 5–30 char noun phrase, not equal to agent name, no
  price in name; description 2 parts, each well under the CJK-char limits which
  bound English text even more loosely).
- Replace `<deployed-domain>` once the service has a real public URL.
