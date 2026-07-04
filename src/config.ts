// Runtime configuration, read from the environment. No secrets are hard-coded.
export const config = {
  port: Number(process.env.PORT ?? 8787),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8787}`,

  // x402 payment target. These are intentionally empty until the Agentic Wallet
  // is set up and the X Layer USDT contract is confirmed — the challenge builder
  // refuses to emit a payable challenge with a blank payTo rather than fabricate one.
  payToAddress: process.env.PAY_TO_ADDRESS ?? "",
  usdtAsset: process.env.USDT_ASSET ?? "",
  usdtDecimals: Number(process.env.USDT_DECIMALS ?? 6),

  // X Layer. Gas-free, chosen for evidence anchoring and settlement.
  network: "eip155:196",

  // Per-call prices in USDT base units.
  prices: {
    compile_spec: process.env.PRICE_COMPILE_SPEC ?? "50000",
    inspect_delivery: process.env.PRICE_INSPECT_DELIVERY ?? "250000",
    evidence_pack: process.env.PRICE_EVIDENCE_PACK ?? "500000",
  },
} as const;

export type ToolName = keyof typeof config.prices;

export function isConfiguredForPayment(): boolean {
  return config.payToAddress !== "" && config.usdtAsset !== "";
}
