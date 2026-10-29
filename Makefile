# DrawingOps developer commands (CLAUDE.md). Run from the repository root.
SHELL := /bin/bash
COMPOSE := docker compose -f deploy/docker-compose.yml --env-file .env
BACKEND := cd backend &&
FRONTEND := cd frontend &&

.PHONY: help env up down logs migrate seed seed-scale test test-backend test-frontend e2e lint schema licences audit sast loadtest restore-drill plugins

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  %-16s %s\n", $$1, $$2}'

env: ## Create .env from deploy/env.example if missing
	@test -f .env || (cp deploy/env.example .env && echo "created .env")

up: env ## Start the full stack (web, worker, beat, postgres, valkey, seaweedfs, caddy, mailpit)
	$(COMPOSE) up -d --build --wait
	@echo "App: http://127.0.0.1:$${HTTP_PORT:-8080}   Mail: http://127.0.0.1:8025"

down: ## Stop the stack
	$(COMPOSE) down

logs: ## Follow logs
	$(COMPOSE) logs -f --tail=100

migrate: ## Apply Django migrations in the running stack
	$(COMPOSE) run --rm migrate

seed: ## Seed demo users for local use and e2e (never in production)
	$(COMPOSE) exec web python manage.py seed_e2e

seed-scale: ## Synthetic 200-user firm for the load and capacity tests (never in production)
	$(COMPOSE) exec web python manage.py seed_scale $(ARGS)

loadtest: ## N-01: 200 users against the compose stack (run seed-scale first); ramp 1/s stays under the per-IP login limit
	mkdir -p loadtest/out
	docker run --rm --network drawingops_default -v "$(CURDIR)/loadtest:/mnt/locust" \
	  locustio/locust:2.37.14 -f /mnt/locust/locustfile.py --host http://caddy:8080 --headless \
	  -u $${USERS:-200} -r $${RATE:-1} -t $${DURATION:-8m} --csv /mnt/locust/out/run --html /mnt/locust/out/report.html

plugins: ## Build and test the CAD plugin core (.NET 8 SDK container)
	docker run --rm -v "$(CURDIR)/plugins:/src" -w /src mcr.microsoft.com/dotnet/sdk:8.0 \
	  dotnet test tests/DrawingOps.Sync.Core.Tests --nologo -v q

restore-drill: ## N-02: restore a backup into a throwaway Postgres and verify it
	scripts/restore_drill.sh $(ARGS)

test: test-backend test-frontend ## pytest + vitest

test-backend: env ## pytest in the dev image (real WeasyPrint/Tesseract) against compose Postgres
	$(COMPOSE) up -d --wait postgres valkey
	$(COMPOSE) --profile test run --rm --build tests pytest --cov --cov-report=term-missing:skip-covered $(ARGS)

test-fast: ## pytest on the host (skips nothing, but needs Pango/Tesseract installed locally)
	$(BACKEND) uv run pytest $(ARGS)

test-frontend: ## vitest
	$(FRONTEND) npm run test

e2e: up seed ## Playwright against the compose stack
	$(FRONTEND) npx playwright test

lint: ## ruff, mypy, eslint, tsc
	$(BACKEND) uv run ruff check . && uv run ruff format --check . && uv run mypy .
	$(FRONTEND) npm run lint && npm run typecheck

schema: ## Regenerate OpenAPI schema and TypeScript client
	$(BACKEND) uv run python manage.py spectacular --settings=config.settings.test --validate --fail-on-warn --file ../frontend/src/lib/api/schema.yaml
	$(FRONTEND) npm run generate:api

licences: ## Fail on GPL/AGPL dependencies
	$(BACKEND) uv run python ../scripts/check_licences.py
	$(FRONTEND) npm run licences

sast: ## Static analysis (Semgrep; Bandit rules run in ruff)
	./scripts/sast.sh

audit: ## Dependency vulnerability scan
	$(BACKEND) uv run pip-audit --strict --progress-spinner off
	$(FRONTEND) npm audit --omit=dev --audit-level=high
