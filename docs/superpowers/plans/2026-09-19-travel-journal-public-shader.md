# 旅迹公开页面与 Shader 邮票 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前静态原型迁移为数据库驱动的公开页面，并实现可降级、可访问的 WebGL2 Shader 邮票交互。

**Architecture:** Server Components 输出完整旅程内容，客户端交互岛负责选择、灯箱、地图和 Shader。邮票的语义、焦点与文字留在 DOM；共享 WebGL Canvas 只渲染像素折射和光泽，CSS 负责齿孔、景深与布局。

**Tech Stack:** Next.js App Router、React、TypeScript、CSS Modules、WebGL2、Vitest、Testing Library、Playwright、axe-core

---

> 前置条件：完成 foundation、auth-admin、media-albums。Commit 步骤仅在 Git 已初始化后执行。

### Task 1：公开旅程读模型与详情路由

**Files:**
- Extend: `modules/journeys/types.ts`
- Modify: `server/repositories/journey-repository.ts`
- Create: `app/(site)/trips/[slug]/page.tsx`
- Create: `app/(site)/trips/[slug]/not-found.tsx`
- Create: `tests-next/journeys/public-journey.test.ts`

- [ ] **Step 1: 写失败的公共读模型测试**

测试 `toPublicJourney` 只返回可序列化字段、按顺序返回 routeStops 和 ready photos、将媒体版本映射为 `/media/{storageKey}/v{version}/{variant}.webp`，且不暴露 originalFilename 或内部路径。

```ts
expect(result.photos[0]).toEqual({
  id: 'photo-1', title: '雨后的花见小路', altText: '京都雨后的街道',
  focalX: 0.5, focalY: 0.4,
  sources: {
    thumb: '/media/journeys/journey-1/photo-1/v2/thumb.webp',
    display: '/media/journeys/journey-1/photo-1/v2/display.webp',
    large: '/media/journeys/journey-1/photo-1/v2/large.webp',
  },
});
```

- [ ] **Step 2: 实现公共详情查询**

`getPublishedJourneyBySlug(slug)` 只能查询 `status: published`，include routeStops、album、ready photos 和 cover；路线、照片均按 sortOrder。不存在或非 published 返回 null。

- [ ] **Step 3: 实现详情路由和 Metadata**

`generateMetadata` 使用城市、标题、描述和封面图；详情页找不到时调用 `notFound()`。页面必须输出标准 `<h1>`、`<time>`、路线 `<ol>` 和相册区域，不能依赖客户端 JavaScript才显示正文。

- [ ] **Step 4: 运行测试与构建**

Run: `npx vitest run tests-next/journeys/public-journey.test.ts && npm run build`

Expected: 读模型测试 PASS，动态路由构建成功。

- [ ] **Step 5: Commit（仅当 Git 已初始化）**

```bash
git add modules/journeys/types.ts server/repositories/journey-repository.ts app/\(site\)/trips tests-next/journeys
git commit -m "feat: add public journey pages"
```

### Task 2：首页旅程体验状态

**Files:**
- Modify: `app/(site)/page.tsx`
- Create: `components/site/journey-experience/journey-experience.tsx`
- Create: `components/site/journey-experience/journey-detail.tsx`
- Create: `components/site/journey-experience/selection-state.ts`
- Create: `tests-next/site/selection-state.test.ts`

- [ ] **Step 1: 写失败的选择状态测试**

```ts
// tests-next/site/selection-state.test.ts
import { describe, expect, it } from 'vitest';
import { adjacentId, commitPreview, previewId } from '../../components/site/journey-experience/selection-state';

const ids = ['lisbon', 'kyoto', 'iceland', 'paris'];

describe('journey selection', () => {
  it('cycles in both directions', () => {
    expect(adjacentId(ids, 'paris', 1)).toBe('lisbon');
    expect(adjacentId(ids, 'lisbon', -1)).toBe('paris');
  });
  it('keeps preview separate from committed selection', () => {
    expect(previewId('kyoto', 'paris')).toBe('paris');
    expect(commitPreview('kyoto', 'paris')).toBe('paris');
  });
});
```

- [ ] **Step 2: 实现纯状态函数**

`adjacentId` 对未知 ID 回退到首项；direction 规范为 -1/1；空数组必须抛出明确错误。预览为空时返回 committed ID。

- [ ] **Step 3: 实现客户端交互岛**

`JourneyExperience` 接收服务端序列化的全部已发布旅程和 initialId。状态包含 `selectedId` 与 `previewId`：pointer enter 只预览；pointer leave 恢复选择；click、Enter、Space、左右键提交选择。详情、相册和地图共用显示中的 journey，地图的 `aria-pressed` 只跟随 committed selection。

- [ ] **Step 4: 保证无 JS 基线**

`page.tsx` 在客户端组件之外输出页面标题和首段旅程的关键文字；顶部每张邮票同时是有效 `/trips/{slug}` 链接或在 `<noscript>` 中提供旅程链接列表。

- [ ] **Step 5: 运行测试**

Run: `npx vitest run tests-next/site/selection-state.test.ts && npm run typecheck`

Expected: 测试 PASS，无类型错误。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add app/\(site\)/page.tsx components/site/journey-experience tests-next/site
git commit -m "feat: add interactive journey selection"
```

### Task 3：相册灯箱与世界地图

**Files:**
- Create: `components/site/gallery/gallery.tsx`
- Create: `components/site/gallery/lightbox.tsx`
- Create: `components/site/world-map/world-map.tsx`
- Create: `components/site/world-map/projection.ts`
- Create: `components/site/world-map/world-map-art.tsx`
- Create: `tests-next/site/projection.test.ts`
- Create: `tests-next/site/lightbox.test.tsx`

- [ ] **Step 1: 写失败的投影测试**

```ts
import { describe, expect, it } from 'vitest';
import { projectGeoPoint } from '../../components/site/world-map/projection';

describe('projectGeoPoint', () => {
  it('maps geographic bounds to percentages', () => {
    expect(projectGeoPoint({ latitude: 90, longitude: -180 })).toEqual({ x: 0, y: 0 });
    expect(projectGeoPoint({ latitude: -90, longitude: 180 })).toEqual({ x: 100, y: 100 });
  });
});
```

- [ ] **Step 2: 实现地图**

使用现有 `index.html` 的 SVG 大陆轮廓迁移到 `world-map-art.tsx`，标记为装饰并 `aria-hidden`。交互标记使用真实按钮，位置来自等距圆柱投影；标签包含城市和日期；点击提交旅程选择并滚动到详情，reduced-motion 时使用 `auto`。

- [ ] **Step 3: 实现灯箱**

使用原生 `<dialog>` 或等价可访问 Dialog：打开时保存触发按钮，关闭后归还焦点；左右键切换，Escape 关闭；计数和标题使用 `aria-live="polite"`；图片使用 large 版本并保留焦点裁切。

- [ ] **Step 4: 运行组件测试**

Run: `npx vitest run tests-next/site/projection.test.ts tests-next/site/lightbox.test.tsx`

Expected: 投影、键盘导航、关闭与焦点恢复 PASS。

- [ ] **Step 5: Commit（仅当 Git 已初始化）**

```bash
git add components/site/gallery components/site/world-map tests-next/site
git commit -m "feat: add public gallery and footprint map"
```

### Task 4：Shader 数学与 WebGL Renderer

**Files:**
- Create: `components/site/shader-stamp-deck/shader-math.ts`
- Create: `components/site/shader-stamp-deck/shaders.ts`
- Create: `components/site/shader-stamp-deck/webgl-renderer.ts`
- Create: `tests-next/shader/shader-math.test.ts`

- [ ] **Step 1: 写失败的指针平滑测试**

```ts
import { describe, expect, it } from 'vitest';
import { damp, normalizedPointer, renderScale } from '../../components/site/shader-stamp-deck/shader-math';

describe('shader math', () => {
  it('normalizes pointer coordinates', () => {
    expect(normalizedPointer({ clientX: 50, clientY: 25 }, { left: 0, top: 0, width: 100, height: 50 })).toEqual({ x: 0.5, y: 0.5 });
  });
  it('caps render scale', () => expect(renderScale(3)).toBe(1.5));
  it('damps toward the target', () => expect(damp(0, 1, 0.5)).toBe(0.5));
});
```

- [ ] **Step 2: 实现 Shader 源码**

顶点 Shader 输出全屏 quad UV。Fragment Shader 接收：

```ts
uResolution: vec2
uPointer: vec2
uVelocity: vec2
uTime: float
uTexture: sampler2D
uIntensity: float
```

实现顺序：计算指针距离场 → 用速度驱动的正弦噪声偏移 UV → 分别偏移 RGB 通道产生轻微折射 → 叠加指针高光 → 添加低强度纸张颗粒。位移最大值限制在 UV 的 0.025，避免内容不可辨认。

- [ ] **Step 3: 实现无框架 WebGL2 Renderer**

`StampRenderer` API 固定为：

```ts
export class StampRenderer {
  constructor(canvas: HTMLCanvasElement, options: { maxDpr: number });
  setItems(items: Array<{
    id: string;
    image: HTMLImageElement;
    rect: { x: number; y: number; width: number; height: number };
  }>): void;
  setActive(id: string): void;
  setPointer(x: number, y: number, velocityX: number, velocityY: number): void;
  resize(width: number, height: number, dpr: number): void;
  start(): void;
  stop(): void;
  destroy(): void;
}
```

只创建一个上下文和一个 program；每段旅程保留一张可复用纹理。每帧按 item rect 设置 viewport/scissor 并绑定对应纹理，从而让单个 Canvas 覆盖多张 DOM 邮票。`destroy` 删除 buffer、program、全部 texture 和监听器。编译失败抛出 `WEBGL_SHADER_COMPILE_FAILED`，由上层降级。

- [ ] **Step 4: 运行数学测试与类型检查**

Run: `npx vitest run tests-next/shader/shader-math.test.ts && npm run typecheck`

Expected: 测试 PASS，Renderer 类型无错误。

- [ ] **Step 5: Commit（仅当 Git 已初始化）**

```bash
git add components/site/shader-stamp-deck tests-next/shader
git commit -m "feat: add webgl stamp renderer"
```

### Task 5：邮票 DOM、Canvas 与降级状态

**Files:**
- Create: `components/site/shader-stamp-deck/shader-stamp-deck.tsx`
- Create: `components/site/shader-stamp-deck/use-stamp-shader.ts`
- Create: `components/site/shader-stamp-deck/shader-stamp-deck.module.css`
- Create: `components/site/shader-stamp-deck/capabilities.ts`
- Create: `tests-next/shader/capabilities.test.ts`
- Create: `tests-next/shader/stamp-deck.test.tsx`

- [ ] **Step 1: 写失败的能力检测测试**

测试 `chooseRenderMode`：reduced-motion 直接返回 `css-static`；无 WebGL2 返回 `css-motion`；Save-Data 返回低质量 WebGL；正常设备返回完整 WebGL。

```ts
expect(chooseRenderMode({ webgl2: true, reducedMotion: true, saveData: false })).toBe('css-static');
expect(chooseRenderMode({ webgl2: false, reducedMotion: false, saveData: false })).toBe('css-motion');
expect(chooseRenderMode({ webgl2: true, reducedMotion: false, saveData: true })).toBe('webgl-low');
```

- [ ] **Step 2: 实现语义邮票结构**

每张邮票必须是按钮或旅程链接，包含城市和日期文字、`aria-pressed`、可见焦点和至少 44×44 CSS 像素操作区。Canvas 设 `aria-hidden="true"` 与 `pointer-events:none`。齿孔仅使用 CSS mask/背景，不将邮票视觉扩散到正文和地图。

- [ ] **Step 3: 实现生命周期**

Hook 必须：

- 动态检测 WebGL2。
- IntersectionObserver 离开视口后 `stop()`。
- `visibilitychange` 在后台暂停。
- `webglcontextlost` preventDefault 并降级，`webglcontextrestored` 最多重建一次。
- ResizeObserver 更新尺寸，DPR 上限 1.5；low 模式上限 1。
- pointermove 使用 requestAnimationFrame 合并，不为每个事件直接 draw。
- 组件卸载调用 `destroy()`。

- [ ] **Step 4: 实现视觉状态**

当前邮票前移并清晰，相邻邮票缩小、偏移和模糊；动效使用 420ms `cubic-bezier(.22,1,.36,1)`。reduced-motion 下 transition-duration 近零，禁用纹理动画，只保留明确选择边框。

- [ ] **Step 5: 运行测试**

Run: `npx vitest run tests-next/shader/capabilities.test.ts tests-next/shader/stamp-deck.test.tsx`

Expected: 降级、ARIA、键盘和清理测试 PASS。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add components/site/shader-stamp-deck tests-next/shader
git commit -m "feat: integrate accessible shader stamps"
```

### Task 6：缓存失效、视觉迁移与公开验收

**Files:**
- Modify: `server/actions/journey-actions.ts`
- Modify: `server/actions/album-actions.ts`
- Create: `tests-e2e/public-site.spec.ts`
- Create: `tests-e2e/shader-fallback.spec.ts`
- Create: `playwright.config.ts`
- Create: `lighthouserc.json`
- Modify: `package.json`

- [ ] **Step 1: 安装 Playwright 与可访问性工具**

Run:

```bash
npm install --save-dev @playwright/test @axe-core/playwright
npm install --save-dev @lhci/cli
npx playwright install chromium
```

在 package scripts 添加：

```json
{
  "test:e2e": "playwright test",
  "test:e2e:update": "playwright test --update-snapshots"
}
```

`lighthouserc.json` 固定使用本地生产服务器并设置数值断言：

```json
{
  "ci": {
    "collect": { "startServerCommand": "npm start", "url": ["http://127.0.0.1:3000/"], "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

- [ ] **Step 2: 实现精确缓存失效**

旅程保存或发布后 revalidate `/`、`/trips/{slug}` 和对应后台页；照片排序、封面和元数据更新后 revalidate 同一路径。不得使用全站无条件清缓存。

- [ ] **Step 3: 迁移现有视觉系统**

从 `styles.css` 提取颜色、字体、间距和地图艺术到 CSS Modules 与 globals。保留温暖纸色、宋体/等宽组合、非对称详情、相册布局和结尾世界地图；不恢复已被用户删除的顶部导航、大标题和首页编辑按钮。

- [ ] **Step 4: 编写 E2E**

`public-site.spec.ts` 覆盖：四张邮票、点击同步标题/相册/地图、左右键、灯箱、地图反向选择、375×812 无横向溢出。`shader-fallback.spec.ts` 在禁用 WebGL 的 init script 下断言 CSS 卡片仍可选择，并在 reduced-motion 环境断言无循环 animation。

- [ ] **Step 5: 运行公开验收**

Run:

```bash
npm run check
npm run build
npm run test:e2e
npx lhci autorun
```

Expected: 全部 PASS；axe 扫描无 serious/critical violations；WebGL 与 fallback 截图均稳定；Lighthouse 配置断言移动模拟下 LCP < 2500ms、CLS < 0.1。使用 Playwright trace 采样正常桌面交互，Shader 动画帧目标接近 60 FPS；中低端节流场景不低于 30 FPS，未达到时自动选择 low 模式。

- [ ] **Step 6: 退役旧原型（只在验收通过后）**

将旧原型复制到 `prototype/reference/` 作为参考，然后删除根目录不再使用的 `index.html`、`styles.css`、`src/` 和 `admin/`；删除旧 Node 契约测试和 `test:legacy` 脚本。再次运行 `npm run check && npm run build && npm run test:e2e`，确认新系统不依赖旧文件。

- [ ] **Step 7: Commit（仅当 Git 已初始化）**

```bash
git add app components server tests-e2e playwright.config.ts package.json package-lock.json prototype
git commit -m "feat: complete public travel experience"
```
