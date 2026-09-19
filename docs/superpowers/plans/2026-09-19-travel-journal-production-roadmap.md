# 旅迹生产化 Roadmap

> **For agentic workers:** Execute the five linked plans in order. Each phase must pass its exit gate before the next phase starts. Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` for execution.

**Goal:** 将当前静态旅行原型逐步迁移为可部署到单台 VPS 的 Next.js、PostgreSQL 和本地媒体生产系统。

**Architecture:** 采用单体 Next.js App Router 应用、PostgreSQL、VPS 本地媒体目录、Nginx 和 Docker Compose。分阶段迁移保证现有静态原型始终可作为视觉与行为基线，直到新系统通过完整验收。

**Tech Stack:** Node.js 24 LTS、Next.js App Router、TypeScript、React、PostgreSQL、Prisma ORM 7、Sharp、WebGL2、Nginx、Docker Compose、Vitest、Testing Library、Playwright

---

## 执行约束

- 当前目录没有 `.git`。各计划仍列出推荐提交点；执行时只有在用户初始化 Git 后才运行提交命令。
- 使用 npm，保留并提交 `package-lock.json`。
- 旧的 `index.html`、`styles.css`、`src/`、`admin/` 和原型测试在 Phase 4 完成前不得删除。
- 新测试放在 `tests-next/`，旧 Node 测试继续通过 `npm run test:legacy` 运行。
- 每个阶段都必须保持 `npm run check` 通过。
- 不得提前加入随笔、多用户、对象存储、Redis、队列或定时异地备份。

## Phase 1：Next.js 与数据库基础

计划：[2026-09-19-travel-journal-foundation.md](./2026-09-19-travel-journal-foundation.md)

交付：

- Next.js App Router 与 TypeScript 可运行。
- PostgreSQL 与 Prisma Schema 可迁移。
- 现有四段旅程导入数据库。
- 新的服务端首页能够读取真实数据库。
- 本地开发 Compose 数据库与基础测试建立。

退出条件：`npm run check`、数据库迁移、种子数据和首页 smoke test 全部通过。

## Phase 2：认证与旅程管理

计划：[2026-09-19-travel-journal-auth-admin.md](./2026-09-19-travel-journal-auth-admin.md)

交付：

- 单管理员创建、密码重置、登录、退出和会话过期。
- `/admin/` 服务端保护。
- 旅程与路线的创建、编辑、预览、发布和归档。
- 登录限流、Origin 校验和管理事件记录。

退出条件：未登录写请求全部被拒绝，管理员可完成旅程 CRUD，草稿不公开。

## Phase 3：媒体与相册

计划：[2026-09-19-travel-journal-media-albums.md](./2026-09-19-travel-journal-media-albums.md)

交付：

- 安全上传与 Sharp 图片派生。
- 本地媒体目录、相对媒体键和不可变版本路径。
- 相册排序、封面、标题、替代文本、删除、恢复和清理。
- 上传失败、磁盘不足和临时文件清理。

退出条件：上传到公开展示的完整 E2E 流程通过，恶意文件与路径穿越测试通过。

## Phase 4：公开页面与 Shader

计划：[2026-09-19-travel-journal-public-shader.md](./2026-09-19-travel-journal-public-shader.md)

交付：

- 公开首页、旅程详情、相册灯箱和世界地图达到现有原型等价。
- 发布后精确缓存失效。
- WebGL2 Shader 邮票、CSS 降级、键盘和移动交互。
- reduced-motion、Save-Data、Context 丢失和视口暂停。

退出条件：桌面、移动、无 WebGL 和 reduced-motion 验收全部通过，旧原型可安全退役。

## Phase 5：生产部署与 VPS 迁移

计划：[2026-09-19-travel-journal-ops.md](./2026-09-19-travel-journal-ops.md)

交付：

- 生产 Dockerfile、Compose、Nginx 和安全响应头。
- 健康检查、日志轮换、磁盘阈值和上传保护。
- `make deploy`、`backup`、`restore`、`migrate`。
- 单 VPS 发布回滚和空白环境迁移演练。

退出条件：从手动迁移包在空白环境恢复成功，数据库记录数与媒体 SHA-256 清单一致。

## 总体验收

- `npm run check`
- `npm run test:e2e`
- `make build`
- `make backup`
- 在干净目录或测试 VPS 执行 `make restore`
- 运行 `make smoke`
- 公开首页无管理入口，`/admin/` 未登录不可访问
- WebGL 关闭后页面仍完整可用

## 规格覆盖索引

| 规格主题 | 实施计划 |
|---|---|
| Next.js、PostgreSQL、Prisma、目录边界 | Phase 1 |
| 数据模型、现有四段旅程导入 | Phase 1 |
| 单管理员、会话、Origin、限流、审计 | Phase 2 |
| 旅程、路线、草稿、预览、发布、归档 | Phase 2 |
| 本地媒体、Sharp、上传限制、原图保护 | Phase 3 |
| 相册排序、封面、回收和清理 | Phase 3 |
| Server Components、缓存失效、详情页 | Phase 4 |
| 灯箱、世界地图、Shader 和性能降级 | Phase 4 |
| Nginx、Docker、多架构镜像、安全头 | Phase 5 |
| 健康检查、磁盘保护、结构化日志 | Phase 5 |
| 手动 backup、restore、migrate 与风险提示 | Phase 5 |
