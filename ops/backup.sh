#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
root=$(data_root)
exec 9>"$root/runtime/ops.lock"; flock -n 9 || exit 1
was_running=$(compose ps --status running -q web)
touch "$root/runtime/read-only"
finish() { rm -f "$root/runtime/read-only"; if [[ -n "$was_running" ]]; then compose up -d web >/dev/null; fi; }
trap finish EXIT
if [[ -n "$was_running" ]]; then compose stop web; fi
compose run --rm -T ops bash ops/archive-inner.sh backup
