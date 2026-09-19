# 旅迹独立管理端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页恢复为纯浏览体验，并在 `/admin/` 构建可操作的相册编辑原型。

**Architecture:** 保持无构建依赖的 HTML、CSS 和 ES Modules。首页继续读取 `src/trips.js`，管理端通过 `admin/index.html`、`admin/admin.css` 和 `admin/admin.js` 独立运行；可测试的相册草稿逻辑放在 `admin/album-state.js`，页面状态不写回首页或磁盘。

**Tech Stack:** HTML5、CSS3、原生 JavaScript ES Modules、Node.js `node:test`、本地静态服务器

---

### Task 1: 首页编辑能力隔离

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `tests/markup.test.js`
- Modify: `tests/app-source.test.js`

- [ ] **Step 1: 写失败的首页边界测试**

在 `tests/markup.test.js` 断言首页不存在 `open-add-trip`、`add-trip-dialog`、`/admin/` 链接或“添加旅程”文案；在 `tests/app-source.test.js` 断言首页脚本不包含 `addTripDialog` 和 `openAddTripButton`。

```js
test('keeps editing controls out of the public homepage', () => {
  const html = loadMarkup();
  for (const token of ['open-add-trip', 'add-trip-dialog', '添加旅程', 'href="/admin/"']) {
    assert.doesNotMatch(html, new RegExp(token));
  }
});
```

- [ ] **Step 2: 运行测试并确认因现有首页按钮与弹层失败**

Run: `node --test tests/markup.test.js tests/app-source.test.js`  
Expected: FAIL，指出首页仍包含添加旅程控件与脚本。

- [ ] **Step 3: 移除首页编辑 UI 与逻辑**

删除顶部按钮、`add-trip-dialog` 标记、所有打开/关闭弹层的事件监听和不再使用的 CSS。保留品牌、公共导航、目的地联动与照片灯箱。

- [ ] **Step 4: 运行首页测试**

Run: `node --test tests/markup.test.js tests/app-source.test.js`  
Expected: PASS，首页旅行浏览与灯箱契约仍通过。

### Task 2: 相册草稿状态模型

**Files:**
- Create: `admin/album-state.js`
- Create: `tests/album-state.test.js`

- [ ] **Step 1: 写失败的状态测试**

覆盖从旅程生成草稿、改标题、移动照片、设置封面、删除照片、最后一张不可删除，以及新增临时照片。

```js
test('moves a photo without losing the cover', () => {
  const draft = createAlbumDraft(sampleTrip);
  const moved = movePhoto(draft, draft.photos[2].id, -1);
  assert.equal(moved.photos[1].id, draft.photos[2].id);
  assert.equal(moved.coverId, draft.coverId);
});

test('keeps at least one photo', () => {
  assert.throws(() => removePhoto(onePhotoDraft, 'photo-1'), /至少保留一张照片/);
});
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run: `node --test tests/album-state.test.js`  
Expected: FAIL，`admin/album-state.js` 不存在。

- [ ] **Step 3: 实现不可变状态函数**

导出：

```js
export function createAlbumDraft(trip) {}
export function renamePhoto(draft, photoId, title) {}
export function movePhoto(draft, photoId, direction) {}
export function setCover(draft, photoId) {}
export function removePhoto(draft, photoId) {}
export function appendPhotos(draft, files) {}
```

每次编辑返回新的 `draft`，保留唯一 `coverId`；删除当前封面后将第一张剩余照片设为封面。

- [ ] **Step 4: 运行状态测试**

Run: `node --test tests/album-state.test.js`  
Expected: 全部 PASS。

### Task 3: `/admin/` 页面结构与视觉系统

**Files:**
- Create: `admin/index.html`
- Create: `admin/admin.css`
- Create: `tests/admin-markup.test.js`

- [ ] **Step 1: 写失败的管理页结构测试**

验证页面包含管理标识、返回网站链接、旅程列表、相册工作区、文件输入、照片网格、保存按钮、删除确认 `dialog` 和原型边界说明。

```js
for (const id of ['trip-list', 'album-grid', 'photo-input', 'save-preview', 'delete-dialog']) {
  assert.match(html, new RegExp(`id="${id}"`));
}
assert.match(html, /所有改动仅用于本次预览/);
assert.match(html, /href="\.\.\/"/);
```

- [ ] **Step 2: 运行测试并确认页面缺失**

Run: `node --test tests/admin-markup.test.js`  
Expected: FAIL，`admin/index.html` 不存在。

- [ ] **Step 3: 实现管理页标记与样式**

创建独立双栏工作台：左侧为旅程列表和原型状态，右侧为工具栏与相册卡片；使用首页纸张色、宋体和等宽字体，但采用更高信息密度。375px 下改为单列，旅程选择横向滚动且不产生页面级溢出。

- [ ] **Step 4: 运行结构测试**

Run: `node --test tests/admin-markup.test.js`  
Expected: PASS。

### Task 4: 管理端交互与反馈

**Files:**
- Create: `admin/admin.js`
- Create: `tests/admin-source.test.js`

- [ ] **Step 1: 写失败的交互契约测试**

验证管理脚本订阅旅程切换、文件选择、标题输入、上移、下移、设置封面、删除确认、保存预览和未保存离开确认。

```js
for (const token of [
  'change', 'renamePhoto', 'movePhoto', 'setCover', 'removePhoto',
  'showModal', 'dirty', 'beforeunload', '保存本次预览'
]) assert.match(source, new RegExp(token));
```

- [ ] **Step 2: 运行测试并确认脚本缺失**

Run: `node --test tests/admin-source.test.js`  
Expected: FAIL，`admin/admin.js` 不存在。

- [ ] **Step 3: 实现页面内草稿交互**

管理脚本从 `trips` 创建各旅程草稿；所有编辑将 `dirty=true`。文件选择仅生成 `URL.createObjectURL` 预览；格式不符显示内联错误。切换旅程、返回网站和刷新时提示未保存修改。删除使用原生 `dialog`，关闭后恢复触发按钮焦点。

- [ ] **Step 4: 实现保存演示反馈**

标题为空时阻止保存并聚焦首个错误输入；否则显示约 1.8 秒的“预览已保存，刷新后仍会恢复”反馈并将 `dirty=false`，不写入首页或后端。

- [ ] **Step 5: 运行全部自动化测试与语法检查**

Run: `npm test && npm run check`  
Expected: 全部 PASS，两个管理端模块通过 `node --check`。

### Task 5: 文档与浏览器验收

**Files:**
- Modify: `package.json`
- Modify: `docs/superpowers/specs/2026-09-08-travel-journal-interactive-prototype-design.md`
- Modify: `docs/superpowers/specs/2026-09-12-travel-journal-admin-design.md`

- [ ] **Step 1: 扩展语法检查命令**

将 `check` 更新为同时检查 `src/*.js`、`admin/album-state.js` 与 `admin/admin.js`。

- [ ] **Step 2: 浏览器验收首页**

在 `/` 验证首页无管理入口，四个目的地、键盘切换、旅程联动和灯箱均正常；控制台无错误。

- [ ] **Step 3: 浏览器验收管理端**

在 `/admin/` 验证切换旅程、添加本地图片、改标题、排序、设封面、删除确认、最后一张保护、保存反馈及未保存离开确认。

- [ ] **Step 4: 响应式验收**

在 375×812 与桌面视口检查 `/` 和 `/admin/` 均无页面级横向溢出，所有交互目标可操作。

- [ ] **Step 5: 更新文档状态并运行最终验证**

Run: `npm test && npm run check && curl -sSf -o /dev/null http://localhost:4173/ && curl -sSf -o /dev/null http://localhost:4173/admin/`  
Expected: 命令退出码 0，测试 0 failure，两个路径均返回成功。

> 注：当前工作目录没有 Git 元数据，因此本计划不包含 commit、merge 或 PR 步骤。
