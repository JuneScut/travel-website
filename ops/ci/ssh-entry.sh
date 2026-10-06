#!/usr/bin/env bash
set -euo pipefail
command=${SSH_ORIGINAL_COMMAND:-}
if [[ "$command" != check && ! "$command" =~ ^deploy\ [0-9a-f]{40}$ ]]; then
  echo '此 SSH 密钥仅允许 check 或 deploy <40 位提交 SHA>。' >&2
  exit 1
fi
{ printf '%s\n' "$command"; if [[ "$command" != check ]]; then cat; fi; } |
  sudo -n /usr/local/libexec/travel-journal/receive-deploy.sh
