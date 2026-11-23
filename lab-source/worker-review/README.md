# Private LAB Worker — review-only, fail-closed snapshot

This subdirectory is a **non-deployable code-review snapshot** of the Worker
from the verified corrected-source archive. It is NOT wired to the commercial
build, CI deployment, or public checkout.

The source archive contains actual hostname/tenant/database role and pinned
Cloudflare Access RSA **public** JWKs/issuer/audience. To avoid publishing
production-specific Access configuration in this public repository, this review
snapshot replaces those strings with deliberately non-operational values:

- `worker/access-keys.ts`: an empty pinned JWK set, rejects every JWT.
- `worker/access-jwt.ts`: invalid issuer and audience placeholders.
- `worker/worker-order-ui-entry.ts`: invalid hostname/project/DB role placeholders.
- `worker/order-lifecycle.ts` and `worker/index.d.mts`: byte-identical to original.

See `review-manifest.json` for **source** and **review** SHA-256 hashes.
The exact original remains in `NEROXA-LAB-ORDER-UI-01-corrected-source.tar.gz`
(SHA-256 `a24acb8c3148f1a3156852d1f1e1d906eb56110f397b8494d879034b15dda53b`),
not committed to GitHub.

The module `worker-order-ui-entry.ts` also imports private SSR output (`index.mjs`)
and an adapter in the original GO03R tree; those are not in this directory.
This snapshot **cannot be compiled into a working Worker** in isolation.
Never replace placeholders on a public branch or remove build gates.

A future private LAB build must, from the protected source archive, re-compose
assets + Worker and verify the live Access JWKS/issuer/audience over an authenticated
channel. It must reject invalid/missing configuration, verify the DB TLS/role and
bounded deadline, and require an explicit, time-limited opening with automatic rollback.
No such build or deployment is performed in this PR.
