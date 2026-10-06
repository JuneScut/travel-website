#!/usr/bin/env bash
set -euo pipefail
docker compose -f compose.dev.yaml -p journal-development up -d
exists=$(docker compose -f compose.dev.yaml -p journal-development exec -T postgres psql -U journal -Atc "SELECT 1 FROM pg_database WHERE datname='journal_test'")
if [[ "$exists" != 1 ]]; then docker compose -f compose.dev.yaml -p journal-development exec -T postgres createdb -U journal journal_test; fi
export DATABASE_URL=postgresql://journal:journal_dev@127.0.0.1:55439/journal_test
export MEDIA_ROOT=.data/media-test RUNTIME_ROOT=.data/runtime-test
npx prisma migrate deploy
npx tsx ops/prepare-tests.ts
npm run test:integration
npm run test:e2e
