#!/usr/bin/env bash
set -euo pipefail
umask 077
mode=${1:?backup or restore}
if [[ "$mode" = backup ]]; then
  work=$(mktemp -d /backups/.archive-XXXXXXXX)
  trap 'rm -rf "$work"' EXIT
  mkdir -p "$work/media"
  pg_dump --format=custom --no-owner --file="$work/database.dump"
  cp -a /data/media/live /data/media/trash "$work/media/"
  cp /app/compose.yaml /app/.env.production.example "$work/"
  cp /app/compose.vps.yaml /app/.env.production.vps.example "$work/"
  cp -a /app/prisma/migrations "$work/migrations"
  printf '%s\n' "$APP_VERSION" > "$work/app-version"
  psql -Atc 'SELECT count(*) FROM "Journey"' > "$work/journey-count"
  psql -Atc 'SELECT count(*) FROM "Photo"' > "$work/photo-count"
  (cd "$work" && find . -type f ! -name manifest.sha256 -print0 | sort -z | xargs -0 sha256sum > manifest.sha256)
  package="/backups/travel-journal-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM.tar.zst"
  tar --zstd -cf "$package" -C "$work" .
  chmod 600 "$package"
  printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > /data/runtime/last-backup
  printf '%s\n' "$package"
elif [[ "$mode" = restore || "$mode" = verify ]]; then
  archive=${2:?archive name}
  [[ "$archive" = /backups/* && -f "$archive" ]] || { echo '归档必须位于 backups 目录' >&2; exit 1; }
  work=$(mktemp -d /backups/.restore-XXXXXXXX)
  trap 'rm -rf "$work"' EXIT
  zstd -dc "$archive" > "$work/package.tar"
  python3 /app/ops/safe-extract.py "$work/package.tar" "$work/content"
  cd "$work/content"
  sha256sum -c manifest.sha256 >/dev/null
  # Refuse any populated target. This command never silently replaces existing user data.
  populated=$(psql -Atc 'SELECT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname = '\''public'\'' AND tablename != '\''_prisma_migrations'\'')')
  if [[ "$populated" = t ]]; then
    nonempty=$(psql -Atc 'SELECT count(*) FROM "Journey"' 2>/dev/null || echo 1)
    admins=$(psql -Atc 'SELECT count(*) FROM "AdminUser"' 2>/dev/null || echo 1)
    [[ "$nonempty" = 0 && "$admins" = 0 ]] || { echo '目标数据库已有内容，拒绝覆盖。请使用空白目标。' >&2; exit 1; }
  fi
  [[ -z "$(find /data/media/live /data/media/trash -type f -print -quit)" ]] || { echo '目标媒体目录非空，拒绝覆盖' >&2; exit 1; }
  if [[ "$mode" = verify ]]; then echo '归档与空白目标验证通过'; exit 0; fi
  pg_restore --clean --if-exists --exit-on-error --single-transaction --no-owner --dbname="$PGDATABASE" database.dump
  cp -a media/live/. /data/media/live/
  cp -a media/trash/. /data/media/trash/
  while IFS= read -r -d '' file; do cmp "$file" "/data/$file"; done < <(find media -type f -print0)
  [[ "$(psql -Atc 'SELECT count(*) FROM "Journey"')" = "$(cat journey-count)" ]]
  [[ "$(psql -Atc 'SELECT count(*) FROM "Photo"')" = "$(cat photo-count)" ]]
  echo "归档已恢复，数据库数量与媒体哈希一致；来源版本 $(cat app-version)。"
else exit 1; fi
