# NEROXA — PR50 OFFLINE CI-01

**Date:** 2026-11-23 · **Scope:** draft PR #50, LAB-only code review · **Commercial:** NO-GO.

## Change delivered

`.github/workflows/neroxa-lab-review-ci.yml` adds automatic checks on pull requests targeting `integration/v1-cloudflare-food-20261120`, when LAB review files change. The job:

1. Checks out only the PR commit, without persisting credentials; grants **contents: read** and has no environment secrets.
2. Fails on modified paths outside `lab-source/**`, `docs/lab/e2e/**` and the single LAB workflow file.
3. Runs `python3 -I lab-source/verify_corrected_source.py` to verify **12 pinned SHA-256 source files**.
4. Runs `python3 -I lab-source/worker-review/verify_review_snapshot.py` to verify **5 pinned Worker hashes** and neutralized Access/host/database-role config.
5. Reports boundaries: no build of Worker/SSR, no live HTTP, no DB, no deployment, no release.

The job does **not** invoke `npm install`, Wrangler, Cloudflare, Supabase, SQL, or production handlers. It does not replace the locally reproduced 12/12 ephemeral RSA negative tests or any LAB runtime security proof.

## CI failure revealed and corrected

Initial run [45198409142](https://github.com/luit77yak-dev/pizza-perfect-plate/actions/runs/45198409142) failed closed at the source verifier:

`HOLD: src/routes/loja/pedido-lab.tsx: HASH_MISMATCH`.

Independent calculation on the 303-byte GitHub source revealed that the expected SHA-256 in the evidence manifest had **63 hex characters** (one missing `6`). The actual 64-character digest is:

`ef16f9a4b5a4698016b7a450f4b5dfab2c8b386f545d1c2d5566e6d5f8293d88`.

This corrected only the manifest digest. The tracking-route source file was **not changed**. All 11 other expected file hashes had valid 64-hex shapes. Follow-up CI is required for a green result; initial failure must not be called PASS.

## Independent limits

- Workflow success means **offline source integrity + fail-closed config + PR scope**, not JWT enforcement in the real Cloudflare host, nonce consumption, cross-tenant isolation, or revoked grant rejection via HTTP.
- No integration to `src/**` runtime, no deployable Worker build, and no production cutover.
- PR stays **DRAFT**. `PUBLIC_CHECKOUT=OFF`; `COMERCIAL=NO-GO`.
