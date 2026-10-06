# 旅迹：开发、部署与维护

当前正式应用使用 Next.js 16、Prisma 7、PostgreSQL 17 与 Sharp。首页和后台都读取数据库；`src/trips.js` 仅用于一次性导入原型内容。旧 Vite 原型仍保留用于视觉对照。

## 本地启动

需要 Node.js 24（本地兼容 22.12+）、Docker Compose。

```sh
npm ci
cp .env.example .env
chmod 600 .env
make db-up
npm run db:migrate
npm run db:seed
npm run admin:create
npm run dev
```

公开页面：`http://localhost:3100`；正式后台：`http://localhost:3100/admin`。管理员密码至少 12 个字符，命令行交互不会显示密码。种子导入是显式且幂等的：不会覆盖后台编辑、重建已删除旅程，也不会在启动时重置数据。

`npm run serve` 仍启动 **Vite 原型**（4173），其中旧管理页明确显示原型模式，不是正式后台；`npm run dev:prototype`、`build:prototype` 与 `preview:prototype` 也只操作原型。

## 管理操作

- 新建旅程会保存为草稿。可先不上传照片，之后添加路线、日期、坐标和照片。
- 保存旅程 / 保存相册将提交当前表单。已发布内容保存后立即更新公开缓存。
- 点击发布才公开草稿。预览页仅对登录管理员可见；撤回草稿或归档会移除公开页面。
- 照片上传后直接落盘并保存数据库，单张失败不撤销同批其他成功照片。每次选择最多 30 张，每批 5 张，每张最多 30 MB，像素上限 8000 万。
- 排序、标题、替代文本、焦点和封面通过保存相册提交。
- 整段旅程删除后公开页面和媒体都不可访问；后台回收区与撤销入口可在 30 天内恢复完整旅程与相册。照片有独立回收区。
- 多窗口编辑使用 revision 冲突检查。发生冲突后当前表单保留，先记录修改再刷新获取最新版本。
- 会话最长 7 天，24 小时无活动过期。密码重置会撤销全部已有会话。

```sh
npm run admin:reset-password
npm run media:cleanup
```

清理是手动命令：重试尚未完成的回收移动，移除 30 天前的回收数据、24 小时前的暂存与失败上传。不配置定时任务。

## VPS 首次部署

推荐 Ubuntu / Debian，2 vCPU、4 GB 内存，照片容量至少三倍的可用磁盘。服务器安装 Docker Engine、Compose、Python 3、rsync、SSH、flock；不需要安装应用 Node.js 或 PostgreSQL。

1. 将项目放在 `/srv/travel-journal/app`。
2. 将 `.env.production.example` 复制为 `.env.production` 并设为 `0600`。填写固定版本号、域名和 `https://` 的 APP_ORIGIN；数据库密码使用 64 位随机十六进制字符串，避免数据库 URL 转义问题。密钥不提交 Git。
3. 用部署用户或 root 执行 `make bootstrap`，应用、媒体、备份目录会归 UID 1000。
4. 为域名签发有效 HTTPS 证书，把 fullchain.pem、privkey.pem 放到 `$DATA_ROOT/certificates/`。证书续签后执行 `docker compose --env-file .env.production exec proxy nginx -s reload`。证书签发与续期由服务器的 ACME 工具负责。
5. 执行以下命令。

```sh
make deploy
make admin-create
make seed       # 可选：导入当前四段旅行与摄影素材
make smoke
```

仅 Nginx 暴露 80/443，数据库和 web 在内部 Docker 网络。应用与维护容器使用非 root 用户。Nginx 将媒体请求交给应用验证公开状态，随后返回长期缓存的不可变 WebP；草稿、删除旅程和原图受到鉴权保护。这是对原计划“直接静态公开派生图片”的收紧，避免未公开内容被绕过读取。

`make seed` 是一次性内容导入维护操作，会短暂停止 web；完成后重新创建应用与代理容器以更新公开缓存。已有旅程不会被覆盖。

## 快速部署和验证

本地先运行 `npm run check` 和 `bash ops/test-local.sh`，更新 `.env.production` 中的固定 `APP_VERSION`，然后在 VPS 运行 `make deploy`。发布保留旧应用镜像，迁移数据库后检查数据库及媒体可用性；失败尝试回到上一应用镜像，数据库迁移不会自动降级。

```sh
make remote-deploy TARGET=deploy@your-vps REMOTE_DIR=/srv/travel-journal/app
make rollback
```

远程命令同步源码，排除本地密钥、数据库、媒体和构建输出；每次自动生成时间戳与 Git 版本组成的发布号，也可用 `APP_VERSION=2026-10-06-v2 make remote-deploy ...` 指定。部署成功后将版本号写入服务器配置，后续维护使用同一镜像。首次执行前，需要目标目录、生产配置和证书已准备好。若本机没有 rsync，则先安装。

建议在预览 VPS 或同一 VPS 的独立目录建立另一套 Compose：独立 `DATA_ROOT`、数据库密码、`APP_ORIGIN` 与域名。使用 `ENV_FILE=.env.preview PROJECT_NAME=travel-journal-preview`，并通过 `HTTP_PORT`、`HTTPS_PORT` 选择独立端口，或接入已有统一反向代理。

远程修改源码可用 VS Code Remote SSH，开发目录运行 `npm run dev`，本地转发：

```sh
ssh -N -L 15173:127.0.0.1:3100 deploy@your-vps
```

浏览器打开 `http://localhost:15173`。为通过 Origin 校验，远程开发配置的 APP_ORIGIN 应为 `http://localhost:15173`，COOKIE_SECURE=false，TRUST_PROXY=false。

## 手动备份与恢复

```sh
make backup
make restore BACKUP=/absolute/path/travel-journal-....tar.zst
make migrate TARGET=deploy@new-vps REMOTE_DIR=/srv/travel-journal/app
```

备份期间停止 web，保证数据库和图片一致，完成后恢复先前运行状态。归档权限 `0600`，包含 PostgreSQL 自定义格式备份、live/trash 媒体、迁移版本、应用版本、配置模板、数量及 SHA-256 清单；不包含密钥、原服务器证书、暂存上传。

恢复只接受空白数据库和媒体目录，拒绝覆盖已有真实内容。恢复会验证归档路径、文件哈希、数据库数量与媒体内容，再迁移并检查健康。保留备份原件，失败时不会自动删除它。

迁移前先在新 VPS 创建目录、独立生产密钥与证书，确保旧版本与新版本数据库迁移兼容。命令检查 Docker、磁盘，传输源码与归档，通过 SSH 恢复并验证；随后手动检查站点和切换 DNS。自动传输不会复制 `.env.production` 或证书。V1 未配置定时或异地备份，须手动把归档下载到另一台设备。

## 验证

```sh
npm run check                # TypeScript、旧原型测试、新单元测试与生产构建
bash ops/test-local.sh        # 专用 journal_test 数据库：真实图片与事务测试、浏览器完整链路
```

测试库与媒体目录独立于开发数据。浏览器验证匿名写入拒绝、草稿隐藏、新建与上传、发布、编辑相册、删除照片与恢复、整段旅程删除后刷新、回收区恢复与移动宽度。

`/api/health` 检查应用版本、数据库、媒体和运行目录，不暴露密钥或文件绝对路径。后台会显示磁盘使用率告警：70% 提醒，95% 停止新上传。
