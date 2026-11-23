#!/usr/bin/env python3
"""Verify the reviewed Worker snapshot is byte-identical and deliberately inert.
Offline, no external dependencies, no remote writes.
"""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'review-manifest.json').read_text(encoding='utf-8'))
expected = manifest['files']
if manifest.get('non_deployable') is not True or len(expected) != 5:
    raise SystemExit('REVIEW_GATE=HOLD: invalid review manifest')
changed = {'access-keys.ts', 'access-jwt.ts', 'worker-order-ui-entry.ts'}
for name, data in expected.items():
    target = root / 'worker' / name
    if target.is_symlink() or not target.is_file():
        raise SystemExit('REVIEW_GATE=HOLD: missing/unsafe ' + name)
    actual = hashlib.sha256(target.read_bytes()).hexdigest()
    if actual != data['review_sha256'] or bool(data['modified']) != (name in changed):
        raise SystemExit('REVIEW_GATE=HOLD: hash or modified-state mismatch ' + name)

keys = (root / 'worker/access-keys.ts').read_text(encoding='utf-8')
jwt = (root / 'worker/access-jwt.ts').read_text(encoding='utf-8')
entry = (root / 'worker/worker-order-ui-entry.ts').read_text(encoding='utf-8')
for required in [
    'PINNED_ACCESS_KEYS: ReadonlyArray<JsonWebKey & {kid?:string}> = []',
]:
    if required not in keys:
        raise SystemExit('REVIEW_GATE=HOLD: Access keys not empty')
for required in ["const ISSUER='https://unconfigured.invalid'", "const AUDIENCE='NOT_CONFIGURED'"]:
    if required not in jwt:
        raise SystemExit('REVIEW_GATE=HOLD: Access config not neutral')
for required in ["const HOST='unconfigured.invalid'", "const PROJECT='NOT_CONFIGURED'", "const ROLE='NOT_CONFIGURED'"]:
    if required not in entry:
        raise SystemExit('REVIEW_GATE=HOLD: Worker config not neutral')
print('WORKER_REVIEW_HASH=PASS; FILES=5; CONFIG_FAIL_CLOSED=PASS')
print('MODE=OFFLINE; NETWORK=NONE; WRITES=NONE; DEPLOY=NOT_PERFORMED')
