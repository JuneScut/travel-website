# 旅迹 JOURNAL

正式应用现已使用 **Next.js + PostgreSQL + Prisma + VPS 本地媒体存储**。后台支持管理员登录、旅程新增/编辑/删除/恢复、草稿发布、路线和相册管理，修改会保存到服务器。

```sh
npm ci
cp .env.example .env
make db-up
npm run db:migrate
npm run db:seed
npm run admin:create
npm run dev       # 正式应用：http://localhost:3100，后台 /admin
```

详细开发、SSH 部署、HTTPS、备份、恢复和 VPS 迁移说明：[生产运行手册](docs/production-runbook.md)。

```sh
npm run check             # 类型检查、原型与服务端单元测试、生产构建
bash ops/test-local.sh    # 独立测试库 + 图片处理 + 浏览器端到端验证
make deploy              # VPS 构建、迁移、健康检查、发布
make backup              # 手动一致性备份
```

以下内容为保留的 Vite 视觉原型说明，原型管理页仍不持久化。真实后台请使用 3100 端口。

基于 React + Vite 的旅行摄影刊物，按 `docs/prototypes/pistachio-cherry/motion.html` 实现。

```sh
npm install
npm run dev:prototype       # http://localhost:5173
npm test          # 数据、状态联动及 React 交互测试
npm run check     # 脚本检查和生产构建
npm run preview:prototype   # 预览 dist，默认 4173
```

`npm run serve` 在 4173 启动开发服务，仍可浏览项目中的设计原型。如果该端口已运行旧的静态服务，可使用默认开发端口 5173。

- `src/App.jsx`：统一管理已选旅程、地图站点和灯箱状态。
- `src/components/`：刊头、封面、邮票、旅程、图片按钮、相册、地图、灯箱和区块标题。
- `src/hooks/`：减少动态效果偏好、滚动揭示、地图加载与生命周期。
- `src/lib/`：旅程状态、地图配色和球面航线计算。
- `src/trips.js`：首页与现有相册管理页共用的旅行数据。

地图使用 MapLibre GL 与 OpenFreeMap，需要网络和 WebGL，进入附近时才加载地图引擎与瓦片；服务不可用时可用时间线和全部站点列表继续浏览。原型中的三处虚构无相册足迹未导入。现有素材每段旅程只有一张照片，沿用六种裁切与说明。

生产构建会保留 `assets/`、`admin/` 和管理页所需的共享数据模块；`dist/` 可由静态服务器托管。相册管理页仍是原有独立工作台，修改仅用于本次预览。

管理入口为 `/admin/`（`/admin` 会自动跳转）。支持添加整段旅程、录入起止日期和路线站点、选择照片，以及删除整段旅程和撤销最近一次删除。新旅程可先不添加照片。点击「保存本次预览」后，切换旅程会保留已保存的照片编辑；刷新或离开页面仍会恢复演示数据，不会修改公开首页或上传到服务器。
