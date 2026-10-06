#!/usr/bin/env bash
set -euo pipefail
target=${1:?SSH target required}
remote_dir=${2:-/srv/travel-journal/app}
[[ "$target" =~ ^[A-Za-z0-9_.@:-]+$ && "$remote_dir" =~ ^/[A-Za-z0-9_./-]+$ ]] || exit 1
repo=$(cd "$(dirname "$0")/.." && pwd)
version=${APP_VERSION:-$(date -u +%Y%m%dT%H%M%SZ)-$(git -C "$repo" rev-parse --short HEAD 2>/dev/null || printf source)}
[[ "$version" =~ ^[A-Za-z0-9][A-Za-z0-9._-]+$ && "$version" != latest ]] || { echo '请使用固定 APP_VERSION' >&2; exit 1; }
rsync -az --exclude node_modules --exclude .git --exclude .next --exclude .next-dev --exclude dist --exclude .data --exclude generated --exclude backups --exclude '*.tar.zst' --exclude '*.tsbuildinfo' --include '.env.production.example' --exclude '.env*' --exclude test-results --exclude playwright-report "$repo/" "$target:$remote_dir/"
ssh "$target" "cd '$remote_dir' && APP_VERSION='$version' make deploy"
