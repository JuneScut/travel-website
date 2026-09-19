# 旅迹生产部署与 VPS 迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将完整应用安全部署到单台 VPS，并提供可验证的发布、手动备份、恢复和跨 VPS 迁移命令。

**Architecture:** Nginx 在前端终止 TLS 并直接提供公开派生图片，Next.js standalone 与 PostgreSQL 只在内部 Compose 网络通信。所有持久数据集中在 `/srv/travel-journal`；备份与迁移通过一次性 ops 容器和 SSH 执行，不配置定时或异地目标。

**Tech Stack:** Docker、Docker Compose、Nginx、Next.js standalone、PostgreSQL、POSIX shell、pg_dump/pg_restore、tar/zstd、rsync、SHA-256、Playwright

---

> 前置条件：完成前四个计划。Commit 步骤仅在 Git 已初始化后执行。

### Task 1：健康检查与只读维护开关

**Files:**
- Create: `app/api/health/route.ts`
- Create: `server/ops/read-only.ts`
- Create: `server/logging/logger.ts`
- Modify: `server/auth/session.ts`
- Modify: `server/actions/journey-actions.ts`
- Modify: `server/actions/album-actions.ts`
- Create: `tests-next/ops/read-only.test.ts`

- [ ] **Step 1: 写失败的只读模式测试**

```ts
// tests-next/ops/read-only.test.ts
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isReadOnlyMode } from '../../server/ops/read-only';

let dir = '';
afterEach(async () => dir && rm(dir, { recursive: true, force: true }));

describe('read-only maintenance mode', () => {
  it('turns on when the runtime flag exists', async () => {
    dir = await mkdtemp(join(tmpdir(), 'travel-runtime-'));
    expect(await isReadOnlyMode(dir)).toBe(false);
    await writeFile(join(dir, 'read-only'), 'backup');
    expect(await isReadOnlyMode(dir)).toBe(true);
  });
});
```

- [ ] **Step 2: 实现维护开关**

`isReadOnlyMode(runtimeRoot = process.env.RUNTIME_ROOT)` 只检查 `{root}/read-only` 文件。`assertMutationsEnabled()` 在只读模式抛出稳定错误码 `READ_ONLY_MODE`。所有管理写 Action 和上传 Route 在认证后、写入前调用该函数。

- [ ] **Step 3: 实现健康检查**

`GET /api/health` 并行执行 `SELECT 1`、读取应用版本、检查 `MEDIA_ROOT` 可读和 `RUNTIME_ROOT` 是否存在。成功返回：

```json
{"status":"ok","database":"ok","media":"ok","version":"<APP_VERSION>"}
```

失败返回 503 和组件级状态，不返回连接字符串、绝对路径或异常堆栈。

`server/logging/logger.ts` 导出 `info`、`warn`、`error`，每行只输出 JSON，固定包含 timestamp、level、event 和 requestId；错误对象只保留 name、code、message，不序列化请求 Cookie、Authorization、密码、会话令牌或图片二进制。认证、上传、部署状态和媒体移动失败统一使用该 logger。

- [ ] **Step 4: 运行测试**

Run: `npx vitest run tests-next/ops/read-only.test.ts && npm run typecheck`

Expected: 测试 PASS，写入口均调用只读守卫。

- [ ] **Step 5: Commit（仅当 Git 已初始化）**

```bash
git add app/api/health server/ops server/auth/session.ts server/actions tests-next/ops
git commit -m "feat: add health and maintenance controls"
```

### Task 2：生产镜像与 Compose

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `compose.yaml`
- Create: `.env.production.example`
- Create: `tests-next/ops/compose-contract.test.ts`

- [ ] **Step 1: 写失败的 Compose 契约测试**

读取 `compose.yaml` 并断言存在 proxy、web、postgres；postgres 不含 host ports；web 只暴露内部 3000；media 分别以 web rw、proxy ro 挂载；服务有 restart policy 和 healthcheck。

- [ ] **Step 2: 创建多阶段 Dockerfile**

Stages：

1. `deps` 使用 Node 24 slim 与 `npm ci`。
2. `builder` 运行 `npx prisma generate` 和 `npm run build`，同时生成 `dist-scripts` 管理 CLI。
3. `runner` 只复制 `.next/standalone`、`.next/static`、`public`、`dist-scripts`、Prisma migration 和运行脚本。

Runner 创建非 root `nextjs` 用户，工作目录只读；仅 `/data/media`、`/data/runtime` 和 `/tmp` 可写。启动命令 `node server.js`。

- [ ] **Step 3: 创建生产 Compose**

```yaml
services:
  proxy:
    image: nginx:stable-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./ops/nginx/site.conf.template:/etc/nginx/templates/default.conf.template:ro
      - ./ops/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro
      - ${MEDIA_DIR}:/data/media:ro
      - ${TLS_DIR}:/etc/letsencrypt:ro
    depends_on:
      web: { condition: service_healthy }
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }

  web:
    image: ${APP_IMAGE}:${APP_VERSION}
    restart: unless-stopped
    env_file: .env.production
    expose: ["3000"]
    volumes:
      - ${MEDIA_DIR}:/data/media
      - ${RUNTIME_DIR}:/data/runtime
    depends_on:
      postgres: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }

  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    env_file: .env.production
    volumes:
      - ${POSTGRES_DIR}:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 10
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }
```

不得为 postgres 添加 `ports`。

`.env.production.example` 必须显式列出 `APP_IMAGE`、`APP_VERSION`、`APP_ORIGIN`、`DATABASE_URL`、PostgreSQL 账号、`MEDIA_DIR`、`POSTGRES_DIR`、`RUNTIME_DIR`、`TLS_DIR`、`MEDIA_ROOT=/data/media`、`RUNTIME_ROOT=/data/runtime` 和 `OFFSITE_BACKUP_CONFIGURED=false`，但不得包含可用密码。

- [ ] **Step 4: 验证镜像与 Compose**

Run:

```bash
docker build -t travel-journal:test .
docker compose --env-file .env.production.example config
npx vitest run tests-next/ops/compose-contract.test.ts
```

Expected: 镜像构建成功、Compose config 有效、契约测试 PASS。

- [ ] **Step 5: 验证多架构镜像构建**

Run:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t "$APP_IMAGE:$APP_VERSION" --push .
docker buildx imagetools inspect "$APP_IMAGE:$APP_VERSION"
```

Expected: manifest 同时列出 `linux/amd64` 和 `linux/arm64`。开发阶段可使用临时私有 registry；不得使用 `latest` 作为生产 tag。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add Dockerfile .dockerignore compose.yaml .env.production.example tests-next/ops
git commit -m "ops: add production containers"
```

### Task 3：Nginx、TLS 与媒体暴露规则

**Files:**
- Create: `ops/nginx/site.conf.template`
- Create: `ops/nginx/security-headers.conf`
- Create: `ops/bootstrap-tls.sh`
- Create: `tests-next/ops/nginx-contract.test.ts`

- [ ] **Step 1: 写失败的 Nginx 契约测试**

测试配置文本包含 HTTPS redirect、`client_max_body_size 160m`、登录限流、CSP、HSTS、nosniff、frame-ancestors，以及只允许版本化 WebP 的媒体正则。断言不存在 `/original` 的 alias。管理端将 30 张选择拆成每请求最多 5 张，因此代理不接受 900 MB 单请求。

- [ ] **Step 2: 实现代理与静态媒体规则**

媒体 location 必须只匹配：

```nginx
location ~ ^/media/(?<media_path>journeys/[0-9a-f-]{36}/[0-9a-f-]{36}/v[1-9][0-9]*/(?:large|display|thumb)\.webp)$ {
    alias /data/media/live/$media_path;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    add_header X-Content-Type-Options nosniff always;
}
```

其他 `/media/` 请求返回 404；配置必须通过 `nginx -t`，并以真实派生图分别验证 200、original 路径验证 404。

反向代理传递 `Host`、`X-Forwarded-Proto`、`X-Real-IP`，关闭流式页面的 proxy buffering；登录 location 使用 `limit_req`。

- [ ] **Step 3: 实现安全响应头**

CSP 至少包含：`default-src 'self'`、`img-src 'self' data: blob:`、`object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`、`form-action 'self'`。同时配置 Referrer-Policy、Permissions-Policy 和 HSTS。

- [ ] **Step 4: 实现 TLS Bootstrap**

脚本接收 `DOMAIN` 与 `EMAIL`，先验证 DNS 解析到当前服务器，再通过一次性 Certbot 容器申请证书。脚本不得复制旧 VPS 私钥；重复运行应安全续签或退出成功。

- [ ] **Step 5: 验证配置**

Run:

```bash
npx vitest run tests-next/ops/nginx-contract.test.ts
docker run --rm -v "$PWD/ops/nginx:/etc/nginx/conf.d:ro" nginx:stable-alpine nginx -t
```

Expected: 测试 PASS，`nginx -t` successful。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add ops/nginx ops/bootstrap-tls.sh tests-next/ops
git commit -m "ops: configure nginx and tls"
```

### Task 4：手动备份命令

**Files:**
- Create: `ops/backup.sh`
- Create: `ops/lib/common.sh`
- Create: `tests-ops/backup.bats`
- Create: `Makefile`

- [ ] **Step 1: 写失败的备份 Shell 测试**

使用 Bats 或独立测试容器，mock `pg_dump` 和最小媒体目录，断言归档包含 `database.dump`、`media.tar.zst`、`manifest.sha256`、`metadata.json`、`.env.example`；输出文件权限为 0600；任何命令失败时清除 `read-only` flag。

- [ ] **Step 2: 实现公共 Shell 安全规则**

所有 ops 脚本开头使用：

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
```

`common.sh` 提供 `require_command`、`require_file`、`require_directory`、`safe_work_dir`、`sha256_file` 和 `cleanup`。临时目录使用 `mktemp -d`，不得使用未校验的通配符删除。

- [ ] **Step 3: 实现 backup.sh**

顺序固定：

1. 检查磁盘剩余空间至少大于数据库估算 + 媒体大小 + 20%。
2. 在 `RUNTIME_DIR/read-only` 写入原因。
3. 用 `docker compose exec -T postgres pg_dump -Fc` 导出数据库。
4. 用 `tar --zstd` 归档 media，排除 staging。
5. 写 metadata：时间、APP_VERSION、迁移版本、文件数、媒体字节数。
6. 对每个文件生成 SHA-256。
7. 打包为 `travel-journal-YYYYmmddTHHMMSSZ.tar.zst`。
8. chmod 0600。
9. 成功后原子写入 `RUNTIME_DIR/last-backup.json`，包含时间、文件名、大小和校验状态。
10. 无论成功失败都由 trap 删除只读 flag。

不得把 `.env.production` 放入归档。

- [ ] **Step 4: 添加 Make 入口**

```make
backup:
	./ops/backup.sh
```

- [ ] **Step 5: 运行备份测试**

Run: `bats tests-ops/backup.bats && make backup`

Expected: 测试 PASS；生成一个 0600 归档；健康检查恢复为可写状态。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add ops/backup.sh ops/lib tests-ops Makefile
git commit -m "ops: add manual backup command"
```

### Task 5：恢复与校验命令

**Files:**
- Create: `ops/restore.sh`
- Create: `ops/verify-backup.sh`
- Create: `tests-ops/restore.bats`
- Modify: `Makefile`

- [ ] **Step 1: 写失败的恢复测试**

覆盖：缺少 BACKUP 拒绝、SHA 不匹配拒绝、目标非空且未传 `--force` 拒绝、成功恢复后运行 `pg_restore` 与媒体哈希复核、任一步骤失败时 web 不被误标为健康。

- [ ] **Step 2: 实现 verify-backup.sh**

只解压到 `mktemp -d`，执行 `sha256sum --check manifest.sha256`，验证 metadata 所需键、`pg_restore --list database.dump` 可读和媒体 tar 可列出。只输出脱敏摘要。

- [ ] **Step 3: 实现 restore.sh**

参数：`--backup <absolute-path>` 与可选 `--force-empty-target`。顺序：验证归档 → 停止 proxy/web → 确认目标 → 创建空数据库 → `pg_restore --exit-on-error --single-transaction` → 恢复 media 到临时目录 → 校验哈希/数量 → 原子切换媒体目录 → 执行 Prisma deploy migration → 启动 web → 轮询 `/api/health` → 启动 proxy。

恢复失败时保留失败日志和原目标目录，不执行无条件递归删除。

- [ ] **Step 4: 添加 Make 入口**

```make
restore:
	@test -n "$(BACKUP)" || (echo "BACKUP is required" && exit 2)
	./ops/restore.sh --backup "$(BACKUP)"
```

- [ ] **Step 5: 在全新卷验证**

Run:

```bash
bats tests-ops/restore.bats
docker compose down
make restore BACKUP=/absolute/path/to/archive.tar.zst
curl -fsS https://$DOMAIN/api/health
```

Expected: 测试 PASS，健康接口 status ok，数据库记录数和媒体 manifest 一致。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add ops/restore.sh ops/verify-backup.sh tests-ops Makefile
git commit -m "ops: add verified restore command"
```

### Task 6：跨 VPS 迁移命令

**Files:**
- Create: `ops/migrate-vps.sh`
- Create: `tests-ops/migrate-vps.bats`
- Modify: `Makefile`

- [ ] **Step 1: 写失败的迁移参数测试**

测试：TARGET 必须是显式 `user@host`；拒绝空值、localhost 和当前主机；目标 Docker/Compose 缺失时在修改源服务器前退出；目标空间不足时退出；传输使用 SSH/rsync，不启动 HTTP server。

- [ ] **Step 2: 实现迁移预检**

通过 SSH 检查：Docker 可用、Compose 可用、目标 `/srv/travel-journal` 可创建、可用空间至少为源数据 1.2 倍、80/443 未被未知服务占用。预检完成前不得进入只读模式。

- [ ] **Step 3: 实现迁移流程**

1. 调用 `backup.sh` 生成最新迁移包。
2. rsync `compose.yaml`、ops、配置模板和归档到目标临时目录。
3. 在目标生成 `.env.production` 的交互式模板，不复制源密钥；用户可以显式选择安全复制密钥。
4. SSH 调用目标 `restore.sh`。
5. 比较源/目标数据库计数、媒体数量和 manifest hash。
6. 输出 DNS A/AAAA 切换值和 `make tls` 命令。
7. 不自动关闭旧 VPS；用户确认新域名健康后手动停止。

- [ ] **Step 4: 添加 Make 入口**

```make
migrate:
	@test -n "$(TARGET)" || (echo "TARGET=user@host is required" && exit 2)
	./ops/migrate-vps.sh "$(TARGET)"
```

- [ ] **Step 5: 运行迁移 Dry Run**

Run: `bats tests-ops/migrate-vps.bats && ./ops/migrate-vps.sh --dry-run user@test-vps`

Expected: 显示完整预检和将执行的步骤，不创建归档、不修改源或目标。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add ops/migrate-vps.sh tests-ops Makefile
git commit -m "ops: add one-command vps migration"
```

### Task 7：部署、回滚、磁盘保护与最终验收

**Files:**
- Create: `ops/deploy.sh`
- Create: `ops/rollback.sh`
- Create: `ops/check-disk.sh`
- Create: `ops/health-check.sh`
- Create: `tests-ops/deploy.bats`
- Modify: `app/admin/layout.tsx`
- Create: `server/ops/status.ts`
- Create: `components/admin/system-status.tsx`
- Create: `tests-next/admin/backup-warning.test.tsx`
- Modify: `Makefile`
- Modify: `README.md`

- [ ] **Step 1: 写失败的部署状态测试**

测试固定镜像 tag、迁移失败不切换、健康检查失败回滚旧 tag、保留最近三个版本、磁盘达到 95% 创建 `uploads-disabled` flag、降到 90% 以下才自动解除。

- [ ] **Step 2: 实现 deploy.sh**

顺序：验证 `APP_VERSION` 非 `latest` → 检查配置和磁盘 → pull/build 镜像 → 记录当前版本 → 运行 Prisma deploy migration → 启动新 web → 健康检查最多 60 秒 → 成功更新 current-version；失败调用 rollback。V1 不自动调用 backup，避免伪装成已配置备份策略。

- [ ] **Step 3: 实现磁盘保护**

`check-disk.sh` 输出 JSON：usedPercent、mediaBytes、databaseBytes、backupBytes。达到 70/85/95 分别为 warning/critical/block；95 创建 runtime flag，上传 Route 返回 507，公开读取不受影响。

脚本每次运行都原子写入 `RUNTIME_DIR/disk-status.json`。`server/ops/status.ts` 只读取并解析 `disk-status.json` 与 `last-backup.json`；缺失时返回明确的 `unknown/never`，不伪造健康状态。

- [ ] **Step 4: 完成 Makefile**

至少包含：

```make
build:
	docker build -t $(APP_IMAGE):$(APP_VERSION) .
build-multiarch:
	docker buildx build --platform linux/amd64,linux/arm64 -t $(APP_IMAGE):$(APP_VERSION) --push .
admin-create:
	docker compose exec web node dist-scripts/scripts/admin-create.js
admin-reset-password:
	docker compose exec web node dist-scripts/scripts/admin-reset-password.js
deploy:
	./ops/deploy.sh
rollback:
	./ops/rollback.sh
backup:
	./ops/backup.sh
restore:
	./ops/restore.sh --backup "$(BACKUP)"
migrate:
	./ops/migrate-vps.sh "$(TARGET)"
smoke:
	./ops/health-check.sh
```

`health-check.sh` 必须检查 HTTPS 首页、`/api/health`、证书剩余有效期、容器 health、磁盘状态文件和 PostgreSQL `SELECT 1`；输出 JSON 摘要并在任一关键检查失败时非零退出。

- [ ] **Step 5: 执行空白环境演练**

在隔离目录或测试 VPS：部署 → 创建管理员 → 导入四段旅程 → 上传照片 → backup → 销毁测试卷 → restore → smoke。比较数据库每表计数和媒体 SHA-256。

- [ ] **Step 6: 运行最终验证**

Run:

```bash
npm run check
npm run build
npm run test:e2e
bats tests-ops/*.bats
docker compose config
make smoke
```

Expected: 全部退出码 0；公开页面、管理端、WebGL fallback、上传、备份、恢复和迁移 dry-run 均通过。

- [ ] **Step 7: 显示未配置异地备份状态**

后台系统状态区显示磁盘占用、上传是否被阻止、最近手动备份时间和校验结果。当 `OFFSITE_BACKUP_CONFIGURED` 不为 `true` 时，后台布局显示持久但不阻断操作的提示：“当前仅支持手动本机备份，VPS 整机损坏时无法恢复。”组件测试断言公开页面不显示这些管理信息、后台显示且可访问；状态文件缺失时显示“尚无数据”，不能显示虚假的 0% 或“已备份”。

- [ ] **Step 8: 更新 README 风险说明**

明确写出：当前没有定时或异地备份；手动归档与源 VPS 同机时不能抵御整机损坏；后续接入第二 VPS 或对象存储不需修改业务代码。

- [ ] **Step 9: Commit（仅当 Git 已初始化）**

```bash
git add ops tests-ops Makefile README.md
git commit -m "ops: complete production deployment workflow"
```
