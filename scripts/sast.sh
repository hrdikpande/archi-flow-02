#!/usr/bin/env bash
# Static analysis (Semgrep) over backend, frontend, plugins and deploy. Code stays local; rules
# come from the Semgrep registry. Ruff's flake8-bandit rules (S) run separately in `make lint`.
# Intentional exceptions carry a `nosemgrep: <rule> -- reason` comment next to the code.
set -euo pipefail
cd "$(dirname "$0")/.."
SEMGREP=${SEMGREP:-"uvx --from semgrep==1.182.1 semgrep"}
$SEMGREP scan --metrics=off --error --quiet \
  --config p/django --config p/python --config p/react --config p/typescript \
  --config p/secrets --config p/owasp-top-ten --config p/docker --config p/csharp \
  --exclude node_modules --exclude 'backend/tests' --exclude '**/migrations' \
  --exclude 'frontend/dist' --exclude 'frontend/e2e' \
  --exclude-rule package_managers.uv.uv-missing-dependency-cooldown.uv-missing-dependency-cooldown \
  backend frontend/src frontend/scripts plugins deploy
