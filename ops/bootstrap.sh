#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
root=$(data_root)
mode=$(proxy_mode)
[[ "$root" = /* && "$root" != / ]] || { echo 'DATA_ROOT 必须是专用绝对路径' >&2; exit 1; }
database_password=$(get_setting POSTGRES_PASSWORD)
[[ "$database_password" =~ ^[0-9a-fA-F]{64}$ ]] || { echo 'POSTGRES_PASSWORD 请使用 64 位随机十六进制字符串' >&2; exit 1; }
umask 077
mkdir -p "$root"/{media/{live,trash,staging},runtime,backups,postgres}
if [[ "$mode" = nginx ]]; then mkdir -p "$root/certificates/challenges"; fi
chown -R 1000:1000 "$root/media" "$root/runtime" "$root/backups"
chmod 700 "$root/runtime" "$root/backups"
chmod 600 "$JOURNAL_ENV_FILE"
if [[ "$mode" = caddy ]]; then
  echo '数据目录已创建。HTTPS 由宿主机 Caddy 管理，可先部署应用再配置域名。'
else
  echo '数据目录已创建。请先为域名签发证书，并放入 certificates/fullchain.pem 与 privkey.pem。'
fi
