# 旅迹个人旅行网站｜生产技术方案

> 文档状态：已确认 / 可进入实施计划  
> 版本：V1.0  
> 日期：2026-09-19  
> 部署目标：单台自有 VPS  
> 当前原型：原生 HTML、CSS、JavaScript，公开首页 `/` 与管理原型 `/admin/`

## 1. 目标

将现有旅行网站原型升级为可长期使用的生产网站：

- 公开展示旅行轨迹、路线、相册和世界足迹地图。
- 顶部目的地选择器实现接近参考作品的 Shader 邮票交互。
- 提供独立 `/admin/` 管理端，供唯一管理员维护旅程和相册。
- 图片保存在 VPS 本地磁盘，数据库使用 PostgreSQL。
- 使用 Docker Compose 部署，并支持从可访问的旧 VPS 一键迁移到新 VPS。
- 第一版提供手动备份、恢复和迁移命令，但不配置定时或异地备份。

## 2. 明确边界

### 2.1 V1 包含

- 单管理员登录、退出、会话过期和服务器侧密码重置。
- 旅程创建、编辑、预览、发布和归档。
- 路线地点、日期、顺序和可选坐标管理。
- 照片上传、处理、排序、标题、替代文本、封面、删除和恢复。
- 公开首页、单段旅程页、相册灯箱和世界地图联动。
- Shader 邮票选择器及 CSS 静态降级。
- PostgreSQL 数据库迁移。
- Docker Compose 部署、健康检查、回滚和 VPS 迁移命令。

### 2.2 V1 不包含

- 随笔或博客。
- 多管理员、角色和协作编辑。
- 用户注册、评论、点赞或社交功能。
- 邮件找回密码。
- 对象存储、CDN、Redis、消息队列或微服务。
- 完整内容历史版本和版本回滚。
- 定时备份、异地备份和灾难恢复承诺。
- 多实例部署和无停机发布。

## 3. 已选技术路线

采用 Next.js 全栈方案：

- Next.js App Router + TypeScript。
- React Server Components 为默认渲染方式。
- Client Components 只用于 Shader、灯箱、地图、拖拽和表单增强。
- Node.js 24 LTS。
- PostgreSQL 稳定版本，生产镜像固定主版本和补丁版本。
- Prisma ORM 7 稳定版；暂不采用候选阶段的 Prisma 8。
- CSS Modules + 全局设计 Token；不引入 UI 组件库。
- Sharp 负责上传图片的方向修正、元数据清理和派生尺寸生成。
- 原生 WebGL2 实现邮票 Shader，不引入完整 Three.js。
- Nginx 负责 HTTPS、反向代理、限流和公开派生图片响应；原图下载仍经过鉴权 Route Handler。
- Docker Compose 管理 Nginx、Next.js 和 PostgreSQL。

## 4. 总体架构

```text
浏览器
  ↓ HTTPS
Nginx
  ├── /media/* → 仅公开 VPS 媒体目录中的派生图片（只读）
  └── 其他请求 → Next.js
                    ├── 公开 Server Components
                    ├── /admin 管理页面
                    ├── Server Actions
                    ├── 上传与健康检查 Route Handlers
                    ├── PostgreSQL
                    └── Sharp → VPS 本地媒体目录（读写）
```

架构约束：

- 单台 VPS、单个 Next.js 实例。
- PostgreSQL 不暴露公网端口。
- 应用镜像无状态；不可替代的数据只存在于 PostgreSQL、媒体目录和部署密钥中。
- 公开页面不能直接执行写操作。
- 管理端所有写入口必须在服务端重新校验会话和输入。
- Shader 失败不能阻止内容读取或目的地选择。

## 5. 项目结构与模块边界

```text
travel-journal/
├── app/
│   ├── (site)/
│   │   ├── page.tsx
│   │   └── trips/[slug]/page.tsx
│   ├── admin/
│   │   ├── login/page.tsx
│   │   ├── page.tsx
│   │   └── trips/[id]/page.tsx
│   ├── api/
│   │   ├── uploads/route.ts
│   │   ├── media/[...path]/route.ts
│   │   └── health/route.ts
│   └── layout.tsx
├── components/
│   ├── site/
│   └── admin/
├── modules/
│   ├── auth/
│   ├── journeys/
│   ├── albums/
│   └── media/
├── server/
│   ├── db/
│   ├── repositories/
│   ├── actions/
│   └── validation/
├── prisma/
├── public/
├── ops/
├── tests/
├── compose.yaml
├── Dockerfile
└── Makefile
```

### 5.1 模块职责

| 模块 | 负责 | 不负责 |
|---|---|---|
| `auth` | 登录、会话、退出、密码重置 | 旅程内容 |
| `journeys` | 城市、日期、路线、坐标、发布状态 | 图片二进制处理 |
| `albums` | 照片归属、标题、排序和封面 | 文件系统写入 |
| `media` | 文件验证、转换、路径、回收和清理 | 页面布局 |
| `shader-stamp-deck` | WebGL、指针交互和降级 | 数据库和认证 |
| `ops` | 部署、备份、恢复、迁移和健康检查 | 业务规则 |

Server Components 直接调用领域服务，不通过 HTTP 请求自己的 Route Handler。普通管理操作使用 Server Actions；文件上传、受控媒体响应和健康检查使用 Route Handlers。

## 6. 数据模型

### 6.1 数据表

| 表 | 主要字段与职责 |
|---|---|
| `admin_users` | UUID、用户名、Argon2id 密码哈希、启用状态、时间戳 |
| `sessions` | UUID、管理员 ID、令牌哈希、过期时间、最后活动时间 |
| `journeys` | UUID、唯一 Slug、城市、国家、日期、标题、描述、坐标、状态、排序 |
| `route_stops` | 旅程 ID、地点、日期、顺序、可选坐标 |
| `albums` | UUID、唯一旅程 ID、标题、封面照片 ID |
| `photos` | UUID、相册 ID、媒体键、原文件名、尺寸、焦点、标题、替代文本、顺序、状态 |
| `admin_events` | 管理员 ID、动作、资源类型、资源 ID、时间、必要上下文 |

### 6.2 关系与约束

- 一个旅程拥有零到多个路线地点。
- 一个旅程拥有一个相册。
- 一个相册拥有零到多张照片和一个可空封面引用。
- `journeys.slug` 唯一。
- 所有业务主键使用 UUID。
- 旅程状态：`draft`、`published`、`archived`。
- 照片状态：`processing`、`ready`、`trashed`、`failed`。
- 公开页面只读取 `published` 旅程和 `ready` 照片。
- 排序更新在数据库事务中完成。
- 已发布旅程的更新在管理员明确点击“保存更新”后生效。
- 新旅程在点击“发布”前不可公开访问。

V1 不保存完整内容版本；`admin_events` 只提供操作审计，不能恢复任意历史内容。

## 7. 媒体存储与处理

### 7.1 目录结构

```text
/data/media/
├── staging/
├── live/
│   └── journeys/{journey-id}/{photo-id}/
│       ├── original.{ext}
│       └── v{media-version}/
│           ├── large.webp
│           ├── display.webp
│           └── thumb.webp
└── trash/
```

数据库保存相对媒体键，不保存 `/data/media` 等主机绝对路径。照片改名或旅程改 Slug 不移动文件。重新裁切或处理时增加 `media-version`，不覆盖浏览器已缓存文件。

### 7.2 上传流程

1. 文件流式写入 `staging`。
2. 校验文件签名、MIME、字节数和像素尺寸。
3. 拒绝 SVG、HTML、可执行内容和伪造类型。
4. 修正方向并默认清除敏感 EXIF。
5. 生成最长边 2560、1600、640 的 WebP。
6. 创建或更新 `processing` 记录。
7. 在同一文件系统内原子移动到 `live`。
8. 将照片标记为 `ready`。
9. 清理中断超过 24 小时的临时文件。

初始限制：单张 30 MB、一次最多选择 30 张；客户端拆成每批最多 5 张上传，单个请求总量不超过 150 MB，并设置最大像素数以防图片解压炸弹。

### 7.3 删除与恢复

- 删除先将数据库状态改为 `trashed`，公开查询立即排除。
- 文件移动到 `trash`，保留 30 天。
- 30 天内允许管理员恢复。
- 清理任务只物理删除超过回收期且数据库仍为 `trashed` 的文件。
- 删除封面时自动选取下一张可用照片。
- 文件移动失败必须记录并允许重试，不能假报成功。

## 8. 认证与安全

### 8.1 单管理员认证

- 不提供注册入口。
- 首次创建：`make admin-create`。
- 密码重置：`make admin-reset-password`。
- 密码使用 Argon2id。
- 会话令牌使用安全随机数，数据库只保存哈希。
- Cookie：`HttpOnly`、`Secure`、`SameSite=Lax`。
- 会话最长 7 天，24 小时无操作过期。
- 修改密码后撤销所有既有会话。

### 8.2 服务端授权

- 页面层校验只负责重定向体验。
- 每个 Server Action 和 Route Handler 都必须再次校验会话。
- 所有写请求校验 `Origin`、输入结构和资源归属。
- 登录按 IP 与账号限流：15 分钟内最多 5 次失败。
- PostgreSQL 只在 Compose 内部网络监听。
- 容器以非 root 用户运行。
- Nginx 配置 CSP、`frame-ancestors 'none'`、`nosniff` 和请求体限制。
- `.env` 不进入代码仓库或普通迁移包，权限限制为部署用户可读。

## 9. 管理端用例

### UC-01 登录

管理员输入账号密码；成功后建立会话并进入旅程列表，失败时显示通用错误并计入限流。

### UC-02 新建并发布旅程

管理员创建草稿，填写地点、日期、介绍、路线和坐标，上传相册，预览后发布。发布成功后首页、地图和详情页缓存失效。

### UC-03 编辑已发布旅程

管理员修改内容；未保存内容只存在于当前表单。点击“保存更新”后事务提交并刷新公开缓存。离开未保存表单时给予提醒。

### UC-04 管理相册

管理员批量上传，查看逐张进度和错误，修改标题与替代文本，拖拽排序并设置封面。单张失败不影响同批其他照片。

### UC-05 删除与恢复

管理员确认后将照片或旅程移入回收区；30 天内可以恢复，超过期限后由清理任务物理删除。

### UC-06 忘记密码

管理员通过 VPS 执行密码重置命令，不通过邮件恢复。

### UC-07 VPS 迁移

管理员在可访问的旧 VPS 执行迁移命令，将数据库和媒体包发送到新 VPS，恢复、迁移、校验后手动切换 DNS。

## 10. 公开页面与 Shader

### 10.1 渲染策略

- 首页与旅程页由 Server Components 输出完整内容。
- 公开内容使用缓存；保存或发布后按旅程精确失效。
- `/admin/` 始终动态渲染。
- 固定尺寸信息用于避免图片布局偏移。
- 媒体派生文件由 Nginx直接提供长期不可变缓存。

### 10.2 Shader 结构

邮票选择器使用 HTML/CSS/WebGL 混合实现：

- HTML `<button>` 保存城市、日期、焦点、键盘和辅助技术语义。
- CSS 实现齿孔、边框、阴影、位移、缩放和相邻景深。
- 单个共享 WebGL2 Canvas 渲染封面纹理、位移场、折射、高光和纸张颗粒。
- Canvas `aria-hidden` 且不承担点击语义。
- Uniforms 包括指针位置、速度、时间、当前索引、分辨率和封面纹理。
- 悬停只预览；点击才固定选择并同步详情、相册和地图。
- 移动端使用横向拖动、滚动吸附和点击，不依赖 hover 或陀螺仪。

### 10.3 降级与性能

降级顺序：WebGL2 → CSS 光泽与景深 → 静态邮票。

- WebGL 初始化或恢复失败后降级。
- `prefers-reduced-motion` 停止循环动画和液态跟随。
- 组件离开视口、页面隐藏或设备启用 Save-Data 时暂停或降帧。
- Canvas 设备像素比上限为 1.5。
- 桌面目标 60 FPS，中低端移动设备目标至少 30 FPS。
- Shader 代码与纹理延迟加载，不阻塞首屏正文。
- 性能目标：LCP < 2.5 秒，CLS < 0.1。

## 11. 部署与运行

### 11.1 Compose 服务

- `proxy`：Nginx，暴露 80/443。
- `web`：Next.js standalone，内部 3000。
- `postgres`：PostgreSQL，仅内部网络。
- `ops`：按需运行的备份、恢复、迁移和检查工具。

建议起步资源：2 vCPU、4 GB 内存、SSD 可用空间至少为当前照片容量的 3 倍。

### 11.2 发布命令

`make deploy`：

1. 校验配置、磁盘空间和数据库连接。
2. 拉取固定版本镜像。
3. 执行版本化数据库迁移。
4. 启动新版本。
5. 执行应用、数据库和媒体健康检查。
6. 成功后完成切换；失败恢复上一镜像。

V1 为单实例，允许部署时出现约 10–30 秒维护窗口。保留最近三个应用镜像版本。

## 12. 备份与 VPS 迁移

### 12.1 V1 决策

V1 不配置定时备份、异地备份或第二台 VPS。只提供手动命令：

```bash
make backup
make restore BACKUP=/path/to/travel-journal.tar.zst
make migrate TARGET=root@new-vps
```

`make backup` 生成：

- PostgreSQL 自定义格式逻辑备份。
- 完整媒体目录归档。
- 应用版本和数据库迁移版本。
- Docker Compose 配置模板。
- 文件数量、容量和 SHA-256 校验清单。
- 不包含明文密钥的环境变量模板。

`make restore` 必须校验归档、恢复数据库与媒体、运行迁移、启动服务并执行健康检查。

`make migrate` 必须检查目标 Docker 环境和磁盘空间，生成迁移包、传输、恢复、校验并输出 DNS 切换提示。域名 DNS 和 HTTPS 证书不从旧 VPS 直接复制；目标服务器重新签发证书。

手动归档默认权限为 `0600`；`make migrate` 通过 SSH 传输，不开放临时 HTTP 下载地址。

### 12.2 已接受风险

只有一台 VPS 且没有异地副本时：

- 可以从仍可访问的旧 VPS 一键迁移。
- 可以用手动生成的本地包恢复误操作。
- 如果 VPS 整机、磁盘或账号同时失效，无法保证恢复。

后台应展示“未配置异地备份”的持久提醒，但不阻止网站运行。后续新增第二台 VPS 或对象存储时，不改变业务代码，只新增备份目标和计划任务。

## 13. 监控与错误处理

监控项：

- 首页、登录页、健康检查。
- Next.js 与 PostgreSQL 状态。
- 数据库连接与慢查询。
- 磁盘使用率。
- 上传和图片处理失败次数。
- 登录失败次数。
- HTTPS 证书有效期。
- 最近一次手动备份时间；未配置定时备份时仅展示状态，不误报为自动保护。

磁盘阈值：70% 后台提示，85% 外部告警，95% 暂停新上传但保持公开读取。

错误处理原则：

- 单张上传失败不回滚其他成功文件。
- 数据库保存失败不改变原有公开内容。
- 磁盘不足立即停止新上传。
- 会话过期时尽可能保留浏览器中的未提交表单。
- 日志使用 JSON 和轮换策略，不记录密码、Cookie、原图或完整令牌。

## 14. 测试与验收

### 14.1 自动化测试

- 单元：输入校验、排序、地图投影、路径安全和权限规则。
- 数据库集成：事务、关联、状态、迁移和软删除。
- 组件：表单、相册排序、错误反馈和键盘交互。
- API：登录、上传、越权、CSRF、恶意文件、限流和路径穿越。
- E2E：登录 → 新建 → 上传 → 预览 → 发布 → 公开展示。
- 视觉：桌面、平板、手机及 reduced-motion 截图。
- Shader：WebGL2、CSS 降级、Context 丢失和键盘操作。
- 运维：空白环境恢复、校验失败、发布回滚和 VPS 迁移演练。

### 14.2 上线验收

- 未登录无法调用任何管理写入口。
- 公开首页没有编辑或管理按钮。
- 新草稿不会出现在公开页面。
- 上传失败不会产生公开的残缺照片。
- 旅程选择同步更新详情、相册和世界地图。
- WebGL 不可用时所有内容和选择功能仍可用。
- 从手动迁移包恢复后，数据库记录数和媒体哈希一致。
- 自动测试、生产构建、数据库迁移和健康检查全部通过。

## 15. 现有原型迁移原则

- 保留当前静态原型作为迁移对照，直到 Next.js 版本达到功能和视觉等价。
- 复用现有视觉 Token、摄影素材、SVG 地图与交互规则。
- 将 `src/trips.js` 的数据导入 PostgreSQL，不继续维护两份生产数据源。
- 将原生 DOM 事件逐步迁移为边界清晰的 React 组件。
- `/admin/` 的页面结构可作为后台交互参考，但草稿内存状态替换为真实服务端存储。
- 迁移完成并通过验收后再移除旧入口。

## 16. 官方参考

- Next.js 自托管：https://nextjs.org/docs/app/guides/self-hosting
- Next.js 部署：https://nextjs.org/docs/app/getting-started/deploying
- Next.js 认证：https://nextjs.org/docs/app/guides/authentication
- Next.js Route Handlers：https://nextjs.org/docs/app/getting-started/route-handlers
- Node.js LTS：https://nodejs.org/en/about/previous-releases
- PostgreSQL 逻辑备份：https://www.postgresql.org/docs/17/backup-dump.html
- PostgreSQL 恢复：https://www.postgresql.org/docs/17/app-pgrestore.html
- Docker Compose 生产部署：https://docs.docker.com/compose/how-tos/production/
- Sharp：https://sharp.pixelplumbing.com/
