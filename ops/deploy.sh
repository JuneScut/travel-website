#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
version=$(get_setting APP_VERSION)
[[ "$version" =~ ^[A-Za-z0-9][A-Za-z0-9._-]+$ && "$version" != latest ]] || { echo '请设置固定 APP_VERSION' >&2; exit 1; }
root=$(data_root)
mode=$(proxy_mode)
[[ -d "$root/runtime" ]] || { echo '请先执行 bootstrap' >&2; exit 1; }
if [[ "$mode" = nginx ]]; then
  [[ -f "$root/certificates/fullchain.pem" && -f "$root/certificates/privkey.pem" ]] || { echo '请先配置 HTTPS 证书' >&2; exit 1; }
else
  web_port >/dev/null
fi
lock_operations
compose config --quiet
previous=$(cat "$root/runtime/current-version" 2>/dev/null || true)
available=$(df -Pk "$root" | awk 'NR==2 {print $4}')
[[ "$available" -gt 1048576 ]] || { echo '可用磁盘空间不足 1 GB' >&2; exit 1; }
# Sequential targets reduce peak memory on a small VPS; layers are shared.
compose build web
compose build ops
compose up -d postgres
compose run --rm -T ops npx prisma migrate deploy
if ! (compose up -d web && health && refresh_proxy); then
  echo '新版本健康检查失败，尝试恢复上一应用版本；数据库迁移不会自动回退。' >&2
  if [[ -n "$previous" ]]; then export APP_VERSION="$previous"; compose up -d web; if health; then refresh_proxy; fi; fi
  exit 1
fi
printf '%s\n' "$version" > "$root/runtime/current-version"
if [[ -n "$previous" && "$previous" != "$version" ]]; then printf '%s\n' "$previous" > "$root/runtime/previous-version"; fi
persist_version "$version"
echo "已部署 ${version}，数据库与媒体检查通过。"
