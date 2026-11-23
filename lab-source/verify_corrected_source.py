#!/usr/bin/env python3
"""Verify the byte-identical corrected Food LAB source snapshot. Offline, read-only."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest_path = root / "docs/lab/e2e/LAB-ORDER-UI-01-2026-11-23.manifest.json"
source_root = root / "lab-source/food-overlay"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
expected = manifest["corrected_integrated_file_sha256"]

if len(expected) != 12:
    raise SystemExit("SOURCE_SHA256=HOLD: manifest must pin exactly 12 files")
failures = []
for relative, sha256 in sorted(expected.items()):
    path = source_root / relative
    if relative.startswith("/") or ".." in Path(relative).parts or path.is_symlink() or not path.is_file():
        failures.append(f"{relative}: MISSING_OR_UNSAFE")
        continue
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != sha256:
        failures.append(f"{relative}: HASH_MISMATCH")

if failures:
    for line in failures:
        print("HOLD:", line)
    raise SystemExit("SOURCE_SHA256=FAIL")
print(f"SOURCE_SHA256=PASS; FILES={len(expected)}; MODE=OFFLINE; WRITES=NONE")
print("SOURCE_IN_LAB_ONLY_DIRECTORY=YES; DEPLOY=NOT_PERFORMED")
