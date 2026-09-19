# 旅迹世界足迹地图 Implementation Plan

> **For agentic workers:** Implement each task in order with test-first changes and verify the live prototype at the end.

**Goal:** 精简公开首页首屏，并在相册结尾增加可浏览、可选择旅程的艺术化世界足迹地图。

**Architecture:** 保留现有静态 HTML/CSS/JavaScript 架构和 `selectedId` 单一选择状态。旅程经纬度保存在 `src/trips.js`；`src/app.js` 用等距圆柱投影计算 HTML 标记位置，地图 SVG 仅负责视觉底图；地图点击继续复用现有 `selectTrip` 流程，并滚动回旅程详情。

**Tech Stack:** HTML5、CSS、原生 JavaScript、Node.js test runner、内联 SVG。

---

## Task 1: 精简首页首屏

**Files:**
- Modify: `tests/markup.test.js`
- Modify: `index.html`
- Modify: `styles.css`

1. 在标记测试中新增断言：首页不再包含 `.site-header`、`.hero-copy`、`#hero-title` 和 `.stats`。
2. 运行 `node --test tests/markup.test.js`，确认新断言失败。
3. 从首页移除品牌导航与大标题统计区，将旅程选择器调整为独立首屏区块。
4. 清理对应样式并补充桌面、移动端的独立旅程索引布局。
5. 再次运行标记测试，确认通过。

## Task 2: 为旅程添加地理坐标

**Files:**
- Modify: `tests/trips.test.js`
- Modify: `src/trips.js`

1. 新增测试：每段旅程必须有数值型 `geo.latitude`、`geo.longitude`，且范围合法。
2. 运行 `node --test tests/trips.test.js`，确认测试失败。
3. 为 Lisbon、Kyoto、Iceland、Paris 增加坐标。
4. 重新运行旅程数据测试，确认通过。

## Task 3: 构建世界足迹地图结构和视觉

**Files:**
- Modify: `tests/markup.test.js`
- Modify: `index.html`
- Modify: `styles.css`

1. 新增结构测试：存在 `#world-map`、`#world-map-title`、`#map-markers`，装饰 SVG 对辅助技术隐藏，地图位于相册之后、页脚之前。
2. 运行标记测试，确认失败。
3. 在相册之后加入地图标题、说明、内联 SVG 大陆轮廓和标记容器。
4. 添加纸张质感、经纬网、大陆轮廓、脉冲标记、悬停标签及响应式样式。
5. 运行标记测试，确认通过。

## Task 4: 接入地图交互与状态同步

**Files:**
- Modify: `tests/app-source.test.js`
- Modify: `src/app.js`

1. 新增源码测试：存在地图渲染、投影、地图旅程标识、当前状态同步、平滑滚动和减少动态效果分支。
2. 运行 `node --test tests/app-source.test.js`，确认失败。
3. 实现经纬度投影和地图标记渲染。
4. 标记悬停/聚焦仅展示地点标签；点击后复用 `selectTrip`，更新顶部选择器与详情，再滚动到 `#footprints`。
5. 旅程索引切换时同步地图当前标记；预览状态不改动已选择标记。
6. 运行应用源码测试，确认通过。

## Task 5: 回归与浏览器验收

**Files:**
- Verify: all project files
- Update if needed: `docs/superpowers/specs/2026-09-14-world-footprint-map-design.md`

1. 运行 `npm test` 和 `npm run check`。
2. 在 `http://localhost:4173/` 验证桌面端首屏、地图落位、四个标记、悬停标签、点击切换与滚动。
3. 用移动端视口验证无横向溢出、标记仍可点击、内容阅读顺序正确。
4. 回归 `http://localhost:4173/admin/`，确认管理原型不受影响。
5. 将设计文档状态更新为已实现，并记录最终交互边界。

**Workspace note:** 当前目录不是 Git 仓库，因此本计划不包含提交、分支或 PR 步骤。
