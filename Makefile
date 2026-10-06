.PHONY: dev db-up build deploy bootstrap smoke backup restore rollback migrate admin-create admin-reset-password seed cleanup remote-deploy prepare-vps caddy-install install-vps
dev:
	npm run dev
db-up:
	docker compose -f compose.dev.yaml -p journal-development up -d
build:
	bash -c 'source ops/common.sh; compose build web && compose build ops'
prepare-vps:
	node ops/prepare-vps.mjs
caddy-install:
	bash ops/install-caddy.sh
install-vps:
	bash ops/install-vps.sh
bootstrap:
	bash ops/bootstrap.sh
deploy:
	bash ops/deploy.sh
rollback:
	bash ops/rollback.sh
backup:
	bash ops/backup.sh
restore:
	bash ops/restore.sh "$(BACKUP)"
migrate:
	bash ops/migrate.sh "$(TARGET)" "$(or $(REMOTE_DIR),/srv/travel-journal/app)"
remote-deploy:
	bash ops/remote-deploy.sh "$(TARGET)" "$(or $(REMOTE_DIR),/srv/travel-journal/app)"
smoke:
	bash -c 'source ops/common.sh; health'
admin-create:
	bash -c 'source ops/common.sh; compose run --rm ops npm run admin:create'
admin-reset-password:
	bash -c 'source ops/common.sh; compose run --rm ops npm run admin:reset-password'
seed:
	bash ops/seed-production.sh
cleanup:
	bash -c 'source ops/common.sh; compose run --rm -T ops npm run media:cleanup'
