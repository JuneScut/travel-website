#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
root=$(data_root)
exec 9>"$root/runtime/ops.lock"; flock -n 9 || exit 1
was_running=$(compose ps --status running -q web)
touch "$root/runtime/read-only"
finish() {
  local status=$?
  trap - EXIT
  rm -f "$root/runtime/read-only"
  if [[ -n "$was_running" ]]; then
    if ! (compose up -d web >/dev/null && health); then
      echo '备份流程结束，但应用恢复后的健康检查失败，请检查容器日志。' >&2
      exit 1
    fi
  fi
  exit "$status"
}
trap finish EXIT
if [[ -n "$was_running" ]]; then compose stop web; fi
compose run --rm -T ops bash ops/archive-inner.sh backup
