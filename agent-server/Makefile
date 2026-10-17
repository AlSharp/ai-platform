COMPOSE = docker compose --env-file .env -f compose.yml
COMPOSE_PROD = docker compose --env-file .env.production -f compose.yml -f compose.production.yml
JOURNAL_API = applications/trading-journal/api

.PHONY: db-up db-down db-status db-logs db-migrate db-migrate-status journal-dev journal-build journal-typecheck prod-up prod-status

db-up:
	$(COMPOSE) up -d postgres

db-down:
	$(COMPOSE) stop postgres

db-status:
	$(COMPOSE) ps

db-logs:
	$(COMPOSE) logs -f postgres

db-migrate:
	APP_ENV_FILE=.env.migration $(COMPOSE) --profile tools run --rm trading-journal-migrate up

db-migrate-status:
	APP_ENV_FILE=.env.migration $(COMPOSE) --profile tools run --rm trading-journal-migrate status

journal-dev:
	npm --prefix $(JOURNAL_API) run dev

journal-build:
	npm --prefix $(JOURNAL_API) run build

journal-typecheck:
	npm --prefix $(JOURNAL_API) run typecheck

prod-up:
	$(COMPOSE_PROD) up -d

prod-status:
	$(COMPOSE_PROD) ps