#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
target=${1:?SSH target required}
remote_dir=${2:-/srv/travel-journal/app}
[[ "$target" =~ ^[A-Za-z0-9_.@:-]+$ && "$remote_dir" =~ ^/[A-Za-z0-9_./-]+$ ]] || exit 1
root=$(data_root)
ssh "$target" "docker version >/dev/null && docker compose version >/dev/null && test -f '$remote_dir/.env.production' && df -Pk '$remote_dir'"
bash "$JOURNAL_REPO/ops/backup.sh"
package=$(find "$root/backups" -maxdepth 1 -name 'travel-journal-*.tar.zst' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
[[ -f "$package" ]] || exit 1
required=$(( $(wc -c < "$package") * 3 / 1024 + 1048576 ))
available=$(ssh "$target" "df -Pk '$remote_dir' | awk 'NR==2 {print \$4}'")
[[ "$available" -gt "$required" ]] || { echo '目标空间不足（需要至少归档体积的三倍及 1 GB 余量）' >&2; exit 1; }
rsync -az --exclude node_modules --exclude .git --exclude .next --exclude .next-dev --exclude dist --exclude .data --exclude generated --exclude backups --exclude '*.tar.zst' --exclude '*.tsbuildinfo' --include '.env.production.example' --include '.env.production.vps.example' --exclude '.env*' --exclude test-results --exclude playwright-report --exclude .agents --exclude .aws --exclude .codex "$JOURNAL_REPO/" "$target:$remote_dir/"
scp "$package" "$target:$remote_dir/$(basename "$package")"
ssh "$target" "cd '$remote_dir' && make build && make restore BACKUP='$remote_dir/$(basename "$package")'"
echo '目标已恢复并校验。请检查新站后手动切换 DNS；Caddy 模式执行 make caddy-install，Nginx 模式单独配置证书。'
