#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
root=$(data_root)
exec 9>"$root/runtime/ops.lock"; flock -n 9 || exit 1
previous=$(cat "$root/runtime/previous-version")
current=$(cat "$root/runtime/current-version")
export APP_VERSION="$previous"
docker image inspect "travel-journal:$previous" >/dev/null
compose up -d web
health
refresh_proxy
persist_version "$previous"
printf '%s\n' "$previous" > "$root/runtime/current-version"
printf '%s\n' "$current" > "$root/runtime/previous-version"
echo "应用已回退至 ${previous}；数据库保持当前结构。"
