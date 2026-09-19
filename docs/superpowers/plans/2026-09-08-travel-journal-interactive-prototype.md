# 旅迹交互原型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 A 方案的可操作旅行轨迹与相册网页原型，并明确排除随笔功能。

**Architecture:** 使用无构建依赖的 HTML、CSS 与 ES Modules。`src/trips.js` 保存目的地数据与纯状态函数，`src/app.js` 负责 DOM 渲染、键盘交互、灯箱和演示弹层，样式集中在 `styles.css`；纯逻辑用 Node 内置测试框架验证。

**Tech Stack:** HTML5、CSS3、原生 JavaScript ES Modules、Node.js `node:test`、Python 静态服务器

---

### Task 1: 旅行状态模型

**Files:**
- Create: `package.json`
- Create: `tests/trips.test.js`
- Create: `src/trips.js`

- [ ] **Step 1: Write the failing test**

测试四个目的地数据、按 ID 选择、循环获取前后目的地，以及非法 ID 回退到京都。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { trips, getTripById, getAdjacentTrip } from '../src/trips.js';

test('provides four destinations', () => assert.equal(trips.length, 4));
test('finds a destination by id', () => assert.equal(getTripById('paris').id, 'paris'));
test('falls back to Kyoto', () => assert.equal(getTripById('missing').id, 'kyoto'));
test('cycles destinations', () => assert.equal(getAdjacentTrip('paris', 1).id, trips[0].id));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trips.test.js`
Expected: FAIL because `src/trips.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

导出 `trips`、`getTripById(id)` 和 `getAdjacentTrip(id, direction)`；默认 ID 为 `kyoto`，方向值仅使用 `-1` 与 `1`。

```js
export const trips = [
  { id: 'lisbon', city: '里斯本' },
  { id: 'kyoto', city: '京都' },
  { id: 'iceland', city: '冰岛' },
  { id: 'paris', city: '巴黎' },
];
export const getTripById = (id) => trips.find((trip) => trip.id === id) ?? trips[1];
export function getAdjacentTrip(id, direction) {
  const index = trips.findIndex((trip) => trip.id === id);
  return trips[(index + direction + trips.length) % trips.length];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/trips.test.js`
Expected: 4 tests pass, 0 fail.

### Task 2: 语义页面与视觉系统

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Add structural contract test**

在 `tests/markup.test.js` 中验证页面包含跳转链接、主标题、目的地按钮容器、旅程内容区域、相册、灯箱与添加旅程 dialog，并确认不存在“随笔”导航。

```js
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /id="trip-selector"/);
assert.match(html, /id="trip-content"/);
assert.match(html, /id="gallery"/);
assert.match(html, /id="lightbox"/);
assert.match(html, /id="add-trip-dialog"/);
assert.doesNotMatch(html, />\s*随笔\s*</);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/markup.test.js`
Expected: FAIL because `index.html` does not exist.

- [ ] **Step 3: Implement semantic markup and styles**

创建语义 HTML；在 CSS 中实现温暖石灰白背景、宋体与等宽字体组合、非对称网格、shader 索引卡片、焦点状态、响应式布局和 reduced-motion 回退。

```html
<main id="main-content">
  <section class="hero" aria-labelledby="hero-title">
    <div id="trip-selector" role="group" aria-label="选择旅行目的地"></div>
  </section>
  <section id="trip-content" aria-live="polite"></section>
  <section id="gallery"></section>
</main>
<dialog id="lightbox"></dialog>
<dialog id="add-trip-dialog"></dialog>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/markup.test.js`
Expected: all markup tests pass.

### Task 3: 目的地联动与键盘切换

**Files:**
- Create: `src/app.js`
- Modify: `index.html`

- [ ] **Step 1: Add source contract tests**

在 `tests/app-source.test.js` 中验证应用订阅 `pointerenter`、`click` 与 `keydown`，更新 `aria-pressed`，并调用旅程渲染函数。

```js
const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
for (const eventName of ['pointerenter', 'click', 'keydown']) assert.match(source, new RegExp(eventName));
assert.match(source, /aria-pressed/);
assert.match(source, /renderTrip/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app-source.test.js`
Expected: FAIL because `src/app.js` does not exist.

- [ ] **Step 3: Implement destination interactions**

根据 `src/trips.js` 渲染四张索引与当前旅程；指针悬停预览、点击固定、左右方向键循环，并同步更新时间轴、照片、文本和统计。

```js
function selectTrip(id, { commit = true } = {}) {
  const trip = getTripById(id);
  if (commit) selectedId = trip.id;
  renderTrip(trip);
}

selector.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  selectTrip(getAdjacentTrip(selectedId, event.key === 'ArrowRight' ? 1 : -1).id);
});
```

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: all tests pass.

### Task 4: 相册灯箱与添加旅程弹层

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`

- [ ] **Step 1: Extend source tests**

验证缩略图打开灯箱、灯箱前后切换、Escape 关闭、添加旅程按钮打开 dialog 以及关闭后归还焦点。

```js
for (const token of ['showModal', 'lightbox', 'ArrowLeft', 'ArrowRight', 'Escape', 'returnValue']) {
  assert.match(source, new RegExp(token));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app-source.test.js`
Expected: FAIL because dialog and lightbox handlers are missing.

- [ ] **Step 3: Implement overlays**

用原生 `<dialog>` 与可访问按钮实现灯箱和添加旅程演示层；上传区只展示说明，不提交文件。

```js
function openLightbox(index) {
  lightboxIndex = index;
  renderLightbox();
  lightbox.showModal();
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && lightbox.open) lightbox.close('dismiss');
});
```

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: all tests pass.

### Task 5: 本地摄影素材与浏览器验收

**Files:**
- Create: `assets/kyoto.png`
- Create: `assets/lisbon.png`
- Create: `assets/iceland.png`
- Create: `assets/paris.png`

- [ ] **Step 1: Generate four coherent travel images**

使用相同的低饱和电影摄影提示体系生成四张地点素材，并复制到 `assets/`。

- [ ] **Step 2: Verify files and tests**

Run: `file assets/*.png && node --test`
Expected: four valid PNG files and all tests pass.

- [ ] **Step 3: Run syntax checks**

Run: `node --check src/trips.js && node --check src/app.js`
Expected: exit code 0 with no output.

- [ ] **Step 4: Browser smoke test**

Run: `python3 -m http.server 4173`
Verify at `http://127.0.0.1:4173`: initial Kyoto state, four destination switches, keyboard cycling, lightbox navigation, dialog open/close, 1440px and 375px layouts, and no console errors.
