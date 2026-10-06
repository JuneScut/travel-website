#!/usr/bin/env bash
set -euo pipefail
JOURNAL_REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
JOURNAL_ENV_FILE=${ENV_FILE:-$JOURNAL_REPO/.env.production}
get_setting() {
  python3 - "$JOURNAL_ENV_FILE" "$1" <<'PY'
import os, sys
values = {}
for line in open(sys.argv[1]):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
sys.stdout.write(os.environ.get(sys.argv[2], values.get(sys.argv[2], '')))
PY
}
proxy_mode() {
  local mode
  mode=$(get_setting PROXY_MODE)
  case "${mode:-nginx}" in
    nginx|caddy) printf '%s' "${mode:-nginx}" ;;
    *) echo 'PROXY_MODE 必须为 nginx 或 caddy' >&2; return 1 ;;
  esac
}
web_port() {
  local port
  port=$(get_setting WEB_PORT)
  port=${port:-3100}
  [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] && (( port <= 65535 )) || { echo 'WEB_PORT 无效' >&2; return 1; }
  printf '%s' "$port"
}
compose() {
  local mode
  mode=$(proxy_mode) || return
  local files=(-f "$JOURNAL_REPO/compose.yaml")
  if [[ "$mode" = caddy ]]; then files+=(-f "$JOURNAL_REPO/compose.vps.yaml"); fi
  docker compose --env-file "$JOURNAL_ENV_FILE" -p "${PROJECT_NAME:-travel-journal}" "${files[@]}" "$@"
}
# Caddy is an existing host service: releases check the loopback port without
# restarting it or waiting for DNS/certificate issuance.
refresh_proxy() {
  local mode port
  mode=$(proxy_mode) || return
  if [[ "$mode" = caddy ]]; then
    port=$(web_port) || return
    curl --noproxy '*' --fail --silent --show-error --max-time 10 "http://127.0.0.1:$port/api/health" >/dev/null
  else
    compose up -d --force-recreate proxy && compose exec -T proxy nginx -t
  fi
}
stop_public_services() {
  local mode
  mode=$(proxy_mode) || return
  if [[ "$mode" = caddy ]]; then compose stop web; else compose stop proxy web; fi
}
data_root() { get_setting DATA_ROOT; }
lock_operations() {
  local lock="$(data_root)/runtime/ops.lock"
  # CI holds this lock before synchronizing source. Reuse its inherited file
  # descriptor, rather than opening a second descriptor and deadlocking.
  if [[ "${JOURNAL_OPS_LOCK_HELD:-}" = "$lock" ]]; then
    [[ "$(readlink "/proc/$$/fd/9" 2>/dev/null)" = "$lock" ]] || { echo '无效的继承发布锁' >&2; return 1; }
  else
    exec 9>"$lock"
  fi
  flock -n 9 || { echo '已有部署或备份操作在运行' >&2; return 1; }
}
health() {
  for _ in $(seq 1 30); do
    if compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

persist_version() {
python3 - "$JOURNAL_ENV_FILE" "$1" <<'PY'
import os, re, sys, tempfile
from pathlib import Path
path = Path(sys.argv[1])
content = path.read_text()
content, count = re.subn(r'^APP_VERSION=.*$', 'APP_VERSION=' + sys.argv[2], content, flags=re.MULTILINE)
if not count:
    content = content.rstrip('\n') + '\nAPP_VERSION=' + sys.argv[2] + '\n'
fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.journal-env-')
try:
    with os.fdopen(fd, 'w') as out:
        out.write(content)
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
PY
}
