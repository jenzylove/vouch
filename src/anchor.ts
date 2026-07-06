// On-chain anchoring: writes a report's hash to X Layer via the onchainos CLI's
// TEE-backed wallet session -- our own code never touches a private key. Uses
// contract-call with the report hash as raw calldata sent to the burn address:
// a lightweight, well-understood "proof of existence" pattern (no contract
// deployment needed) that costs nothing, since X Layer is gas-free for this
// wallet.
//
// Degrades gracefully if the CLI isn't present in the current environment
// (e.g. not yet bundled into a deployed container) -- anchoring is a
// nice-to-have enrichment, never a hard dependency for producing a report.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Anchor } from "./report.js";

const execFileAsync = promisify(execFile);

const ONCHAINOS_BIN = process.env.ONCHAINOS_BIN || "onchainos";
const XLAYER_EIP155 = "eip155:196";

// The classic burn address: no contract code, owned by no one, can never
// execute anything. Calldata sent here is always accepted verbatim and
// permanently recorded -- unlike our OWN wallet address, which is itself a
// smart-contract (ERC-4337) account and reverts when arbitrary calldata
// doesn't match one of its function selectors (confirmed by testing: sending
// the hash to our own address failed "execution reverted" on every attempt;
// sending to this address succeeded every time).
const ANCHOR_TARGET = "0x000000000000000000000000000000000000dEaD";

export class AnchoringUnavailableError extends Error {
  constructor(msg = "onchainos CLI is not available in this environment") {
    super(msg);
    this.name = "AnchoringUnavailableError";
  }
}

interface ContractCallResponse {
  ok: boolean;
  data?: { txHash?: string; orderId?: string };
  error?: string;
}

// Anchors a hex-encoded hash (no "0x" prefix) by sending it as calldata to the
// burn address. `walletAddress` is the sender (our agentic wallet) -- required
// so we fail fast if payment/wallet config is missing, not because it's the
// on-chain recipient.
export async function anchorHash(hashHex: string, walletAddress: string): Promise<Anchor> {
  if (!walletAddress) {
    throw new AnchoringUnavailableError("no wallet address configured (PAY_TO_ADDRESS)");
  }

  let stdout: string;
  try {
    const result = await execFileAsync(
      ONCHAINOS_BIN,
      [
        "wallet", "contract-call",
        "--to", ANCHOR_TARGET,
        "--chain", "xlayer",
        "--input-data", `0x${hashHex}`,
        "--biz-type", "dapp",
        "--force",
      ],
      { timeout: 45000 },
    );
    stdout = result.stdout;
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stdout?: string };
    if (err.code === "ENOENT") throw new AnchoringUnavailableError();
    // The CLI prints a JSON error body even on non-zero exit -- prefer that
    // over Node's generic "Command failed" wrapper message.
    let cliErrorMessage: string | undefined;
    if (err.stdout) {
      try {
        cliErrorMessage = (JSON.parse(err.stdout) as ContractCallResponse).error;
      } catch {
        // stdout wasn't JSON -- fall through to the generic message below
      }
    }
    throw new Error(cliErrorMessage
      ? `anchor transaction rejected: ${cliErrorMessage}`
      : `anchor transaction failed: ${(e as Error).message}`);
  }

  let parsed: ContractCallResponse;
  try {
    parsed = JSON.parse(stdout) as ContractCallResponse;
  } catch {
    throw new Error(`anchor transaction returned non-JSON output: ${stdout.slice(0, 300)}`);
  }
  if (!parsed.ok || !parsed.data?.txHash) {
    throw new Error(`anchor transaction rejected: ${parsed.error ?? "unknown error"}`);
  }
  return { chain: XLAYER_EIP155, txHash: parsed.data.txHash };
}
