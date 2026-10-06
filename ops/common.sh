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
compose() { docker compose --env-file "$JOURNAL_ENV_FILE" -p "${PROJECT_NAME:-travel-journal}" -f "$JOURNAL_REPO/compose.yaml" "$@"; }
data_root() { get_setting DATA_ROOT; }
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
