#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
root=$(data_root)
backup=${1:?provide archive absolute path}
[[ "$backup" = /* && -f "$backup" ]] || exit 1
exec 9>"$root/runtime/ops.lock"; flock -n 9 || exit 1
name=$(basename "$backup")
[[ "$name" =~ ^[A-Za-z0-9._-]+$ ]] || exit 1
if [[ "$backup" != "$root/backups/$name" ]]; then cp "$backup" "$root/backups/$name"; chown 1000:1000 "$root/backups/$name"; chmod 600 "$root/backups/$name"; fi
compose up -d postgres
compose run --rm -T ops bash ops/archive-inner.sh verify "/backups/$name"
touch "$root/runtime/read-only"
trap 'rm -f "$root/runtime/read-only"' EXIT
stop_public_services
compose up -d postgres
compose run --rm -T ops bash ops/archive-inner.sh restore "/backups/$name"
compose run --rm -T ops npx prisma migrate deploy
rm -f "$root/runtime/read-only"
compose up -d web
health
refresh_proxy
get_setting APP_VERSION > "$root/runtime/current-version"
printf "\n" >> "$root/runtime/current-version"
echo '恢复完成，健康检查通过。'
