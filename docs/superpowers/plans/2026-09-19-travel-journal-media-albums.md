# 旅迹媒体上传与相册管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立安全的 VPS 本地图片管线，并让管理员完成上传、排序、封面、编辑、回收和恢复。

**Architecture:** 上传先进入 `staging`，验证后由 Sharp 生成三档 WebP，再原子移动到 UUID 媒体目录并标记为 ready。数据库只保存相对媒体键；公开路径只能访问版本化派生图，原图必须经过管理员鉴权。

**Tech Stack:** Next.js Route Handlers、Node.js File System API、Sharp、file-type、PostgreSQL、Prisma、Vitest、Playwright

---

> 前置条件：完成 foundation 与 auth-admin 计划。Commit 步骤仅在 Git 已初始化后执行。

### Task 1：安全媒体键与路径边界

**Files:**
- Create: `modules/media/media-key.ts`
- Create: `server/media/paths.ts`
- Create: `tests-next/media/media-key.test.ts`

- [ ] **Step 1: 写失败的路径安全测试**

```ts
// tests-next/media/media-key.test.ts
import { describe, expect, it } from 'vitest';
import { createStorageKey, parsePublicVariantPath } from '../../modules/media/media-key';

describe('media keys', () => {
  it('creates an id-only relative key', () => {
    expect(createStorageKey('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'))
      .toBe('journeys/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222');
  });

  it('accepts only versioned public variants', () => {
    const path = 'journeys/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/v2/display.webp';
    expect(parsePublicVariantPath(path)).toEqual({
      key: 'journeys/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222',
      version: 2,
      variant: 'display',
    });
    for (const unsafe of ['../secret', 'journeys/a/b/original.jpg', 'journeys/a/b/v1/../../secret', 'journeys/a/b/v0/thumb.webp']) {
      expect(() => parsePublicVariantPath(unsafe)).toThrow();
    }
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run tests-next/media/media-key.test.ts`

Expected: FAIL，媒体键模块不存在。

- [ ] **Step 3: 实现严格解析器**

`createStorageKey` 必须用 Zod UUID 校验两个 ID。`parsePublicVariantPath` 必须使用完整正则匹配：

```ts
const publicVariantPattern = /^journeys\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/v([1-9][0-9]*)\/(large|display|thumb)\.webp$/i;
```

禁止 `..`、反斜杠、空字节、`original` 和未知扩展名。

- [ ] **Step 4: 实现根目录约束**

`server/media/paths.ts` 使用 `path.resolve(MEDIA_ROOT, relative)`，并验证结果以 `path.resolve(MEDIA_ROOT) + path.sep` 开头。导出 `stagingPath(uploadId)`、`livePhotoPath(storageKey)`、`trashPhotoPath(photoId)` 和 `publicVariantPath(parsed)`。

- [ ] **Step 5: 运行测试**

Run: `npx vitest run tests-next/media/media-key.test.ts`

Expected: 全部 PASS。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add modules/media server/media tests-next/media
git commit -m "feat: add safe media path boundaries"
```

### Task 2：文件验证与 Sharp 派生图

**Files:**
- Modify: `package.json`
- Create: `server/media/validate-upload.ts`
- Create: `server/media/process-image.ts`
- Create: `tests-next/media/validate-upload.test.ts`
- Create: `tests-next/fixtures/photo.jpg`
- Create: `tests-next/fixtures/fake.jpg`

- [ ] **Step 1: 写失败的上传验证测试**

```ts
// tests-next/media/validate-upload.test.ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateImageBuffer } from '../../server/media/validate-upload';

describe('validateImageBuffer', () => {
  it('accepts a real JPEG and returns detected type', async () => {
    const buffer = await readFile(new URL('../fixtures/photo.jpg', import.meta.url));
    await expect(validateImageBuffer(buffer, 'image/jpeg')).resolves.toMatchObject({ ext: 'jpg', mime: 'image/jpeg' });
  });

  it('rejects HTML renamed as JPEG', async () => {
    const buffer = await readFile(new URL('../fixtures/fake.jpg', import.meta.url));
    await expect(validateImageBuffer(buffer, 'image/jpeg')).rejects.toThrow('UNSUPPORTED_IMAGE');
  });
});
```

- [ ] **Step 2: 安装依赖并确认测试失败**

Run:

```bash
npm install sharp file-type
npx vitest run tests-next/media/validate-upload.test.ts
```

Expected: FAIL，验证函数不存在。

- [ ] **Step 3: 实现签名、大小和像素验证**

`validateImageBuffer` 必须：

- 字节数不超过 30 MiB。
- 使用 `fileTypeFromBuffer` 检测真实格式。
- 只允许 JPEG、PNG、WebP、AVIF。
- 检测 MIME 必须与浏览器声明兼容。
- 使用 `sharp(buffer).metadata()`，宽高必须存在。
- 总像素数不超过 80,000,000。
- 禁止 SVG、GIF、TIFF、HTML 和未知格式。

- [ ] **Step 4: 实现图片处理函数**

```ts
export type ProcessedImage = {
  original: { ext: string; width: number; height: number; byteSize: number };
  variants: Array<{ name: 'large' | 'display' | 'thumb'; width: number; height: number; path: string }>;
};

export async function processImage(inputPath: string, outputDir: string): Promise<ProcessedImage>;
```

实现要求：读取时应用 `rotate()` 修正 EXIF 方向；输出不调用 `withMetadata()`，从而不复制敏感 EXIF；分别生成最长边 2560、1600、640 的 WebP，`withoutEnlargement: true`，质量分别 84、82、78。

- [ ] **Step 5: 验证输出**

Run a focused script against `tests-next/fixtures/photo.jpg`，然后执行：

```bash
file .data/test-output/*.webp
identify .data/test-output/*.webp
```

Expected: 三个有效 WebP，最长边不超过规定尺寸。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add package.json package-lock.json server/media tests-next/media tests-next/fixtures
git commit -m "feat: validate and derive uploaded photos"
```

### Task 3：认证上传 Route Handler

**Files:**
- Create: `app/api/uploads/route.ts`
- Create: `server/services/media-upload-service.ts`
- Create: `tests-next/media/upload-service.test.ts`

- [ ] **Step 1: 写失败的上传状态测试**

使用临时目录和一个 mock repository，验证成功流程按顺序产生 `processing → ready`；处理异常产生 `failed`；单个请求不允许超过 5 个文件或 150 MiB。管理端一次可选择 30 张，但必须拆批发送。

核心断言：

```ts
expect(repository.statuses).toEqual(['processing', 'ready']);
expect(await exists(join(mediaRoot, 'live', storageKey, 'v1', 'display.webp'))).toBe(true);
```

- [ ] **Step 2: 实现媒体上传服务**

`uploadPhoto` 必须：

1. 创建 `uploadId` 和 `photoId`。
2. 流式写入 `staging/{uploadId}`，写入时累计并限制 30 MiB。
3. 运行签名和像素验证。
4. 创建 `processing` Photo 记录。
5. 在临时输出目录生成原图和 v1 派生图。
6. 使用 `rename()` 原子移动到 `live`。
7. 更新宽高、字节数、扩展名和 `ready`。
8. 失败时设置 `failed` 并清除 staging。

文件移动成功而数据库更新失败时保留目录并写结构化错误，后续孤儿清理按 photoId 修复；不得删除可能已成功写入的原图。

- [ ] **Step 3: 实现 Route Handler**

`POST /api/uploads` 必须调用 `assertTrustedOrigin` 和 `requireAdminForMutation`，读取 `albumId` 和多文件 FormData，限制每请求 5 张、总计 150 MiB，并以逐文件结果返回：

```ts
type UploadResponse = {
  results: Array<
    | { filename: string; ok: true; photoId: string }
    | { filename: string; ok: false; code: 'TYPE' | 'SIZE' | 'PIXELS' | 'DISK' | 'PROCESSING' }
  >;
};
```

不得在响应中返回绝对文件路径或内部异常堆栈。

- [ ] **Step 4: 运行服务测试和越权测试**

Run: `npx vitest run tests-next/media/upload-service.test.ts && npm run typecheck`

Expected: 成功、失败清理、批量限制和未授权分支全部 PASS。

- [ ] **Step 5: Commit（仅当 Git 已初始化）**

```bash
git add app/api/uploads server/services/media-upload-service.ts tests-next/media
git commit -m "feat: add authenticated photo uploads"
```

### Task 4：相册事务与回收策略

**Files:**
- Create: `modules/albums/schemas.ts`
- Create: `server/services/album-service.ts`
- Create: `server/actions/album-actions.ts`
- Create: `tests-next/albums/album-service.test.ts`

- [ ] **Step 1: 写失败的相册规则测试**

测试以下行为：

- 排序输入必须恰好包含相册当前所有 ready 照片且不得重复。
- 封面必须属于该相册且状态为 ready。
- 删除最后一张照片后封面置空。
- 删除当前封面时选择排序后的第一张 ready 照片。
- 恢复照片时不自动抢占已有封面。

- [ ] **Step 2: 实现输入 Schema**

```ts
export const reorderPhotosSchema = z.object({
  albumId: z.string().uuid(),
  photoIds: z.array(z.string().uuid()).min(1).superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: '照片不能重复' });
  }),
});
```

同时定义标题、替代文本、焦点 `0..1`、封面、删除和恢复输入。

- [ ] **Step 3: 实现 Album Service**

导出：

```ts
export async function reorderPhotos(albumId: string, ids: string[], adminId: string): Promise<void>;
export async function updatePhotoMetadata(photoId: string, input: PhotoMetadataInput, adminId: string): Promise<void>;
export async function setAlbumCover(albumId: string, photoId: string, adminId: string): Promise<void>;
export async function trashPhoto(photoId: string, adminId: string): Promise<void>;
export async function restorePhoto(photoId: string, adminId: string): Promise<void>;
```

数据库状态更新必须事务化。文件移动发生在事务提交后；移动失败时记录 `media.move.failed` 事件并使后台显示“等待修复”，公开查询仍排除 trashed 记录。

- [ ] **Step 4: 实现 Server Actions**

每个 Action 校验 Origin、会话、Zod 和照片归属。成功后 `revalidatePath('/admin/trips/[id]')`，已发布旅程同时 revalidate 首页和公开旅程路径。

- [ ] **Step 5: 运行测试**

Run: `npx vitest run tests-next/albums/album-service.test.ts`

Expected: 所有规则 PASS。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add modules/albums server/services/album-service.ts server/actions/album-actions.ts tests-next/albums
git commit -m "feat: add album ordering and recycle rules"
```

### Task 5：相册编辑器与批量上传反馈

**Files:**
- Modify: `app/admin/trips/[id]/page.tsx`
- Create: `components/admin/album-editor/album-editor.tsx`
- Create: `components/admin/album-editor/upload-queue.tsx`
- Create: `components/admin/album-editor/photo-card.tsx`
- Create: `tests-next/admin/album-editor.test.tsx`

- [ ] **Step 1: 写失败的组件测试**

测试必须覆盖：上传队列逐文件状态、失败重试、标题与替代文本 label、设置封面、上移/下移键盘替代操作、删除确认和最后焦点恢复。

- [ ] **Step 2: 实现上传队列**

选择文件后在客户端先检查最多 30 张和浏览器报告大小，再按每批最多 5 张发送 FormData，最多并发两批。每张图片显示 `等待 / 上传中 / 处理 / 完成 / 失败`，失败项保留重试按钮。不得用一个全局错误抹掉已成功结果。

- [ ] **Step 3: 实现排序与编辑**

拖拽只改变本地顺序，点击“保存排序”后调用 Action；同时提供上移和下移按钮，确保键盘用户不依赖拖拽。封面卡片显示明确徽标。

- [ ] **Step 4: 实现删除和恢复反馈**

删除使用 `<dialog>` 明确显示照片标题；成功后焦点移动到相邻照片或相册标题。回收区单独折叠展示，提供恢复按钮和剩余天数。

- [ ] **Step 5: 运行组件和浏览器测试**

Run: `npx vitest run tests-next/admin/album-editor.test.tsx && npm run typecheck`

Verify：批量上传部分失败、排序、设封面、删除、恢复均正常；公开页面只显示 ready 照片。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add app/admin/trips components/admin/album-editor tests-next/admin
git commit -m "feat: add album administration"
```

### Task 6：公开派生图与清理命令

**Files:**
- Create: `app/api/media/[...path]/route.ts`
- Create: `app/api/admin/photos/[id]/original/route.ts`
- Create: `scripts/media-cleanup.ts`
- Create: `scripts/media-audit.ts`
- Create: `tests-next/media/media-cleanup.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 写失败的清理测试**

使用临时目录和假时钟，验证 29 天的 trash 保留、31 天的 trash 删除、live 孤儿只报告不自动删除、staging 超过 24 小时才删除。

- [ ] **Step 2: 实现开发媒体 Route**

GET Handler 只接受 `parsePublicVariantPath` 成功的路径，返回 `image/webp`、`Cache-Control: public, max-age=31536000, immutable` 和 `X-Content-Type-Options: nosniff`。任何 original、trash、staging 或非法路径返回 404。

管理员原图下载使用独立的 `GET /api/admin/photos/[id]/original`：先调用 `requireAdmin()`，通过 photoId 查询数据库并用安全路径解析器定位文件，响应使用 `Content-Disposition: attachment` 和清理后的下载文件名。未登录返回 401，不接受任意路径参数。

- [ ] **Step 3: 实现审计与清理 CLI**

`media-audit` 比较数据库与磁盘，输出 missing、orphan、stale-staging、expired-trash 四类 JSON 统计。`media-cleanup` 只删除 stale staging 和数据库确认已 trashed 超过 30 天的目录；默认 dry-run，只有 `--apply` 才删除。

在 `package.json` 添加：

```json
{
  "media:audit": "tsx scripts/media-audit.ts",
  "media:cleanup": "tsx scripts/media-cleanup.ts",
  "media:cleanup:apply": "tsx scripts/media-cleanup.ts --apply"
}
```

- [ ] **Step 4: 运行测试和审计**

Run: `npx vitest run tests-next/media/media-cleanup.test.ts && npm run media:audit`

Expected: 测试 PASS；审计输出有效 JSON 且不修改文件。

- [ ] **Step 5: Commit（仅当 Git 已初始化）**

```bash
git add app/api/media scripts tests-next/media package.json package-lock.json
git commit -m "feat: serve and maintain local media"
```
