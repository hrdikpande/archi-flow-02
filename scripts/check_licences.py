"""Fail on GPL/AGPL Python dependencies (CLAUDE.md, BUILD_PROMPT rule 2).

LGPL libraries used unmodified as libraries are allowed (e.g. psycopg). Run inside the backend
virtualenv: `cd backend && uv run python ../scripts/check_licences.py`.
"""

import json
import re
import subprocess
import sys

COPYLEFT = re.compile(r"\b(A?GPL|GNU (Affero )?General Public)", re.IGNORECASE)
LESSER = re.compile(r"\b(LGPL|Lesser)", re.IGNORECASE)
# Packages whose metadata says GPL for a part we do not use, reviewed by a human.
REVIEWED_EXCEPTIONS: dict[str, str] = {}


def main() -> int:
    raw = subprocess.run(
        ["pip-licenses", "--format=json", "--with-system", "--from=mixed"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    failures = []
    for pkg in json.loads(raw):
        name, licence = pkg["Name"], pkg["License"]
        if name in REVIEWED_EXCEPTIONS:
            continue
        if COPYLEFT.search(licence) and not LESSER.search(licence):
            failures.append(f"{name} {pkg['Version']}: {licence}")
    if failures:
        print("Copyleft licences found (not allowed):", *failures, sep="\n  ")
        return 1
    print(f"Licence check passed ({len(json.loads(raw))} packages).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
