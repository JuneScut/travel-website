#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $# = 0 ]] || exit 1
# sudo drops client environment; the paths below are fixed by the installer.
root=${JOURNAL_CI_ROOT:-/srv/travel-journal}
app="$root/app"
export ENV_FILE="$app/.env.production"
unset APP_VERSION PROJECT_NAME JOURNAL_OPS_LOCK_HELD
source "$app/ops/common.sh"
[[ "$(data_root)" = "$root" ]] || { echo '生产数据目录与 CI 入口不一致' >&2; exit 1; }
IFS= read -r command
if [[ "$command" = check ]]; then
  docker info >/dev/null
  refresh_proxy
  echo 'travel-journal deployment SSH ready'
  exit 0
fi
[[ "$command" =~ ^deploy\ ([0-9a-f]{40})$ ]] || { echo '发布命令无效' >&2; exit 1; }
revision=${BASH_REMATCH[1]}
version="ci-${revision:0:12}"
# Lock both the archive transfer/source sync and the existing deployment script.
lock_operations
export JOURNAL_OPS_LOCK_HELD="$root/runtime/ops.lock"
work=$(mktemp -d "$root/runtime/.ci-deploy-XXXXXXXX")
finish() { rm -rf -- "$work"; }
trap finish EXIT
timeout 120s head -c 33554433 > "$work/source.tar.gz"
[[ $(stat -c %s "$work/source.tar.gz") -le 33554432 ]] || { echo '发布包超过 32 MiB' >&2; exit 1; }
python3 "$(dirname "$0")/extract-source.py" "$work/source.tar.gz" "$work/source" "$revision"
for required in Dockerfile compose.yaml compose.vps.yaml ops/common.sh ops/deploy.sh; do
  [[ -f "$work/source/$required" ]] || { echo "发布包缺少 $required" >&2; exit 1; }
done
if [[ "$(get_setting APP_VERSION)" = "$version" ]] && health; then
  refresh_proxy
  echo "提交 $revision 已部署，无需重复发布。"
  exit 0
fi
protect=(--exclude .git --exclude .data --exclude node_modules --exclude .next --exclude .next-dev
  --exclude generated --exclude dist --exclude backups --exclude postgres --exclude media --exclude runtime
  --exclude .agents --exclude .aws --exclude .codex --exclude .worktrees
  --include .env.example --include .env.production.example --include .env.production.vps.example --exclude '.env*'
  --exclude '*.tar.zst' --exclude '*.tsbuildinfo' --exclude test-results --exclude playwright-report)
rsync -a "${protect[@]}" "$app/" "$work/previous/"
if ! rsync -a --delete "${protect[@]}" "$work/source/" "$app/" ||
   ! APP_VERSION="$version" bash "$app/ops/deploy.sh"; then
  rsync -a --delete "${protect[@]}" "$work/previous/" "$app/"
  echo '自动部署失败，生产源码已恢复；数据库迁移不会自动回退。' >&2
  exit 1
fi
printf '%s\n' "$revision" > "$root/runtime/last-ci-revision"
echo "自动部署成功：$revision ($version)"
