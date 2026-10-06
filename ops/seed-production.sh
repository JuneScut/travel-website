#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
root=$(data_root)
exec 9>"$root/runtime/ops.lock"; flock -n 9 || { echo '已有部署或备份操作在运行' >&2; exit 1; }
was_running=$(compose ps --status running -q web)
finish() {
  if [[ -n "$was_running" ]]; then
    # A fresh container drops the public data cache populated before this explicit import.
    compose up -d --force-recreate web
    health
    refresh_proxy
  fi
}
trap finish EXIT
if [[ -n "$was_running" ]]; then compose stop web; fi
compose run --rm -T ops npm run db:seed
