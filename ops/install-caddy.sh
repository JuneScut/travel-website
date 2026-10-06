#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
[[ "$(proxy_mode)" = caddy ]] || { echo '此命令仅用于 PROXY_MODE=caddy' >&2; exit 1; }
root=$(data_root)
[[ -d "$root/runtime" ]] || { echo '请先执行 bootstrap' >&2; exit 1; }
config=${CADDY_CONFIG:-/etc/caddy/Caddyfile}
[[ -f "$config" && ! -L "$config" ]] || { echo 'Caddyfile 必须是现有普通文件' >&2; exit 1; }
exec 9>"$root/runtime/ops.lock"; flock -n 9 || exit 1
node "$JOURNAL_REPO/ops/prepare-vps.mjs" --render-only
fragment=${JOURNAL_PREPARE_DIR:-$JOURNAL_REPO/.data/deploy}/travel-journal.caddy
candidate=$(mktemp "$(dirname "$config")/.travel-journal-caddy-XXXXXXXX")
trap 'rm -f "$candidate"' EXIT
python3 - "$config" "$fragment" "$candidate" "$(get_setting DOMAIN)" <<'PY'
import re, sys
from pathlib import Path
config, fragment, candidate = map(Path, sys.argv[1:4])
content = config.read_text()
begin = '# BEGIN travel-journal managed site'
end = '# END travel-journal managed site'
block = begin + '\n' + fragment.read_text().rstrip() + '\n' + end + '\n'
if begin in content or end in content:
    if content.count(begin) != 1 or content.count(end) != 1:
        raise SystemExit('Caddy 管理区块不完整，拒绝修改。')
    content, count = re.subn(re.escape(begin) + r'\n.*?' + re.escape(end) + r'\n?', lambda _: block, content, flags=re.S)
    if count != 1:
        raise SystemExit('Caddy 管理区块顺序异常，拒绝修改。')
else:
    if sys.argv[4] in content:
        raise SystemExit('域名已在现有 Caddyfile 中出现，拒绝覆盖其配置。')
    content = content.rstrip() + '\n\n' + block
candidate.write_text(content)
PY
caddy validate --adapter caddyfile --config "$candidate"
if cmp -s "$candidate" "$config"; then echo 'Caddy 配置已是当前版本，无需重载。'; exit 0; fi
backup="$root/runtime/Caddyfile.before-$(date -u +%Y%m%dT%H%M%SZ)-$$"
cp -p "$config" "$backup"
chmod 600 "$backup"
install -m 644 "$candidate" "$config"
if ! systemctl reload caddy; then
  cp -p "$backup" "$config"
  systemctl reload caddy || true
  echo "Caddy 重载失败，已还原配置；备份：$backup" >&2
  exit 1
fi
echo "Caddy 已接入 $(get_setting DOMAIN)，原配置备份：$backup"
