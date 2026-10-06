#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
for command in docker node python3 rsync caddy curl flock; do
  command -v "$command" >/dev/null || { echo "缺少命令：$command" >&2; exit 1; }
done
# Fail before writing server directories if the session cannot access Docker.
docker info >/dev/null
node "$JOURNAL_REPO/ops/prepare-vps.mjs"
[[ "$(proxy_mode)" = caddy ]] || exit 1
root=$(data_root)
production="$root/app"
if [[ "$JOURNAL_REPO" != "$production" ]]; then
  if [[ -f "$production/.env.production" ]] && ! cmp -s "$JOURNAL_ENV_FILE" "$production/.env.production"; then
    echo '生产目录已有不同配置，拒绝覆盖。后续发布请在生产目录执行 make deploy。' >&2
    exit 1
  fi
  mkdir -p "$production"
  rsync -a --exclude node_modules --exclude .git --exclude .next --exclude .next-dev \
    --exclude dist --exclude .data --exclude generated --exclude backups --exclude '.env*' \
    --exclude '*.tar.zst' --exclude '*.tsbuildinfo' --exclude test-results --exclude playwright-report \
    --exclude .agents --exclude .aws --exclude .codex --exclude .worktrees "$JOURNAL_REPO/" "$production/"
  install -m 644 "$JOURNAL_REPO/.env.production.example" "$production/.env.production.example"
  install -m 644 "$JOURNAL_REPO/.env.production.vps.example" "$production/.env.production.vps.example"
  install -m 600 "$JOURNAL_ENV_FILE" "$production/.env.production"
  install -d -m 700 "$production/.data/deploy"
  prepared=${JOURNAL_PREPARE_DIR:-$JOURNAL_REPO/.data/deploy}
  if [[ ! -f "$production/.data/deploy/admin-password" ]]; then
    install -m 600 "$prepared/admin-password" "$production/.data/deploy/admin-password"
  fi
  exec env ENV_FILE="$production/.env.production" JOURNAL_PREPARE_DIR="$production/.data/deploy" bash "$production/ops/install-vps.sh"
fi
bash "$JOURNAL_REPO/ops/bootstrap.sh"
bash "$JOURNAL_REPO/ops/deploy.sh"
if [[ ! -f "$root/runtime/admin-initialized" ]]; then
  prepared=${JOURNAL_PREPARE_DIR:-$JOURNAL_REPO/.data/deploy}
  compose run --rm -T ops npm run admin:create -- admin < "$prepared/admin-password"
  touch "$root/runtime/admin-initialized"
fi
bash "$JOURNAL_REPO/ops/seed-production.sh"
bash "$JOURNAL_REPO/ops/install-caddy.sh"
bash "$JOURNAL_REPO/ops/backup.sh"
health
refresh_proxy
origin=$(get_setting APP_ORIGIN)
if ! curl --noproxy '*' --fail --silent --show-error --max-time 20 "$origin/api/health"; then
  echo '应用与备份已完成，但域名 HTTPS 健康检查失败；请检查 DNS 与 Caddy 日志。' >&2
  exit 1
fi
curl --noproxy '*' --fail --silent --show-error --max-time 20 "$origin/" >/dev/null
curl --noproxy '*' --fail --silent --show-error --max-time 20 "$origin/admin/login" >/dev/null
printf '\n网站已部署：%s；管理员：admin；初始密码文件：%s\n' "$origin" "$JOURNAL_REPO/.data/deploy/admin-password"
