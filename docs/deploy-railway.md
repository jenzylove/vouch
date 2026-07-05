# Deploying Vouch to Railway

Why Railway and not Vercel: Vercel's serverless functions have a read-only
filesystem (only `/tmp`, wiped between invocations) — incompatible with
Vouch's current design, which persists the ed25519 signing key
(`data/service-key.pem`) and every report (`data/reports/*.json`) to local
disk. Railway runs a normal long-running process with a real filesystem, so
none of that has to change. It also has the best GitHub-connected deploy
experience of the persistent-storage options (Nixpacks auto-detects Node, no
Dockerfile needed) and no cold-start penalty (unlike Render's free tier,
which sleeps after 15 minutes idle — risky for judges or the leaderboard
stunt hitting an idle instance).

`railway.json` is already committed with explicit build/start commands, so
Railway's Nixpacks builder needs no further configuration.

## One-time setup (needs your browser — this is the part Claude can't do)

1. Go to **[railway.app](https://railway.app)** and sign in (GitHub login is
   the easiest — it doubles as repo access).
2. **New Project → Deploy from GitHub repo** → pick the `vouch` repo.
3. Railway auto-detects the Nixpacks build from `railway.json` — no
   Dockerfile, no extra config needed.
4. **Add a Volume** (Railway dashboard → your service → Settings → Volumes):
   mount it at `/app/data`. This is what makes the signing key and reports
   survive restarts and redeploys — without it, every redeploy silently
   generates a **new** signing key and loses every prior report.
5. **Set environment variables** (Settings → Variables) — copy every value
   from your local `.env` *except* `PORT` (Railway injects its own) and
   `PUBLIC_BASE_URL` (set this to the Railway-assigned domain once you have
   it, e.g. `https://vouch-production.up.railway.app` — see step 6):
   - `ANTHROPIC_API_KEY`
   - `PAY_TO_ADDRESS`
   - `USDT_ASSET`
   - `USDT_DECIMALS`
   - `PRICE_COMPILE_SPEC`, `PRICE_INSPECT_DELIVERY`, `PRICE_EVIDENCE_PACK`
   - Do **not** set `ALLOW_UNPAID` here — that flag must never exist in a
     deployed environment.
6. Railway assigns a public domain automatically (Settings → Networking →
   Generate Domain, if it isn't already there). Copy that URL into
   `PUBLIC_BASE_URL` in the Variables tab, then redeploy — this is the URL
   every report/badge link and the x402 challenge's `resource` field will use.
7. Verify: `curl https://<your-domain>/health` should return
   `{"ok":true,...}`. Then confirm `/app`, `/calibration`, and a paid route
   (with `X-PAYMENT` header, until real payment verification is wired) all
   work against the live URL.

## Redeploying

Every `git push` to the connected branch triggers an automatic redeploy — no
manual step needed after the initial connection.

## The public URL becomes the ASP endpoint

Once step 6 is done, `<your-domain>/compile_spec`, `/inspect_delivery`, and
`/evidence_pack` are the three endpoint URLs to use in
[`docs/asp-registration.md`](asp-registration.md) — replace every
`<deployed-domain>` placeholder there with the real Railway domain.
