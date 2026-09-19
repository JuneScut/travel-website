# 旅迹单管理员认证与内容管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/admin/` 增加单管理员认证，并实现旅程与路线的草稿、发布、更新和归档流程。

**Architecture:** 使用 Argon2id 密码哈希和 PostgreSQL 持久会话，Cookie 只保存随机原始令牌，数据库只保存 SHA-256 哈希。管理表单通过 Server Actions 调用旅程服务；每个写入口独立校验会话、Origin 和 Zod 输入。

**Tech Stack:** Next.js Server Actions、PostgreSQL、Prisma ORM 7、Argon2、Zod、Vitest、Testing Library、Playwright

---

> 前置条件：完成 `2026-09-19-travel-journal-foundation.md`。Commit 步骤仅在 Git 已初始化后执行。

### Task 1：密码与会话原语

**Files:**
- Modify: `package.json`
- Create: `modules/auth/password.ts`
- Create: `modules/auth/tokens.ts`
- Create: `modules/auth/session-policy.ts`
- Create: `tests-next/auth/auth-primitives.test.ts`

- [ ] **Step 1: 写失败的认证原语测试**

```ts
// tests-next/auth/auth-primitives.test.ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../modules/auth/password';
import { createSessionToken, hashSessionToken } from '../../modules/auth/tokens';
import { sessionExpiresAt } from '../../modules/auth/session-policy';

describe('auth primitives', () => {
  it('hashes and verifies a password without retaining plaintext', async () => {
    const hash = await hashPassword('a-correct-horse-battery-staple');
    expect(hash).not.toContain('correct-horse');
    await expect(verifyPassword(hash, 'a-correct-horse-battery-staple')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('creates a random token and deterministic SHA-256 hash', () => {
    const token = createSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(hashSessionToken(token)).toHaveLength(64);
  });

  it('expires sessions after seven days', () => {
    const now = new Date('2026-09-19T00:00:00Z');
    expect(sessionExpiresAt(now).toISOString()).toBe('2026-09-26T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run tests-next/auth/auth-primitives.test.ts`

Expected: FAIL，认证模块不存在。

- [ ] **Step 3: 安装并实现认证原语**

Run: `npm install argon2`

```ts
// modules/auth/password.ts
import argon2 from 'argon2';

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password, { type: argon2.argon2id });
}
```

```ts
// modules/auth/tokens.ts
import { createHash, randomBytes } from 'node:crypto';
export const createSessionToken = () => randomBytes(32).toString('base64url');
export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');
```

```ts
// modules/auth/session-policy.ts
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_IDLE_SECONDS = 24 * 60 * 60;
export function sessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
}
```

- [ ] **Step 4: 运行测试**

Run: `npx vitest run tests-next/auth/auth-primitives.test.ts`

Expected: 3 tests PASS。

- [ ] **Step 5: Commit（仅当 Git 已初始化）**

```bash
git add package.json package-lock.json modules/auth tests-next/auth
git commit -m "feat: add password and session primitives"
```

### Task 2：会话仓储与服务器侧守卫

**Files:**
- Create: `server/auth/session.ts`
- Create: `server/auth/origin.ts`
- Create: `server/repositories/session-repository.ts`
- Create: `tests-next/auth/origin.test.ts`
- Create: `tests-next/auth/session-policy.test.ts`

- [ ] **Step 1: 写失败的 Origin 与空闲过期测试**

```ts
// tests-next/auth/origin.test.ts
import { describe, expect, it } from 'vitest';
import { isTrustedOrigin } from '../../server/auth/origin';

describe('isTrustedOrigin', () => {
  it('accepts only the configured origin', () => {
    expect(isTrustedOrigin('https://journal.example.com', 'https://journal.example.com')).toBe(true);
    expect(isTrustedOrigin('https://evil.example', 'https://journal.example.com')).toBe(false);
    expect(isTrustedOrigin(null, 'https://journal.example.com')).toBe(false);
  });
});
```

```ts
// tests-next/auth/session-policy.test.ts
import { describe, expect, it } from 'vitest';
import { isSessionActive } from '../../server/auth/session';

describe('isSessionActive', () => {
  it('rejects absolute and idle expiration', () => {
    const now = new Date('2026-09-19T12:00:00Z');
    expect(isSessionActive({ expiresAt: new Date('2026-09-20T00:00:00Z'), lastActiveAt: new Date('2026-09-19T11:00:00Z') }, now)).toBe(true);
    expect(isSessionActive({ expiresAt: new Date('2026-09-19T11:00:00Z'), lastActiveAt: now }, now)).toBe(false);
    expect(isSessionActive({ expiresAt: new Date('2026-09-20T00:00:00Z'), lastActiveAt: new Date('2026-09-18T11:59:59Z') }, now)).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run tests-next/auth/origin.test.ts tests-next/auth/session-policy.test.ts`

Expected: FAIL，函数不存在。

- [ ] **Step 3: 实现会话仓储和策略**

`session-repository.ts` 必须导出：

```ts
export async function createSession(adminId: string, tokenHash: string, expiresAt: Date): Promise<void>;
export async function findSessionByTokenHash(tokenHash: string): Promise<SessionWithAdmin | null>;
export async function touchSession(id: string, at: Date): Promise<void>;
export async function deleteSessionByTokenHash(tokenHash: string): Promise<void>;
export async function deleteAllAdminSessions(adminId: string): Promise<void>;
```

`server/auth/session.ts` 必须：

- 从 `await cookies()` 读取 `SESSION_COOKIE_NAME`。
- 哈希令牌后查询数据库。
- 同时检查绝对过期、24 小时空闲过期和管理员 `enabled`。
- 认证失败时删除无效 Cookie。
- `requireAdmin()` 未认证时调用 `redirect('/admin/login')`。
- 写操作使用 `requireAdminForMutation()` 返回管理员 ID，不只依赖页面守卫。
- 创建会话 Cookie 时固定 `httpOnly: true`、`secure: process.env.NODE_ENV === 'production'`、`sameSite: 'lax'`、`path: '/'` 和 7 天 `maxAge`；退出和失效时使用同名同路径 Cookie 清除。

```ts
export function isSessionActive(
  session: { expiresAt: Date; lastActiveAt: Date },
  now = new Date(),
) {
  return session.expiresAt > now && now.getTime() - session.lastActiveAt.getTime() <= 24 * 60 * 60 * 1000;
}
```

`origin.ts`：

```ts
export const isTrustedOrigin = (origin: string | null, appOrigin: string) => origin === appOrigin;
export function assertTrustedOrigin(origin: string | null) {
  if (!process.env.APP_ORIGIN || !isTrustedOrigin(origin, process.env.APP_ORIGIN)) {
    throw new Error('UNTRUSTED_ORIGIN');
  }
}
```

- [ ] **Step 4: 运行测试**

Run: `npx vitest run tests-next/auth/origin.test.ts tests-next/auth/session-policy.test.ts`

Expected: 全部 PASS。

- [ ] **Step 5: Commit（仅当 Git 已初始化）**

```bash
git add server/auth server/repositories tests-next/auth
git commit -m "feat: persist and verify admin sessions"
```

### Task 3：管理员创建与密码重置 CLI

**Files:**
- Create: `scripts/admin-create.ts`
- Create: `scripts/admin-reset-password.ts`
- Create: `tsconfig.scripts.json`
- Create: `modules/auth/credentials.ts`
- Create: `tests-next/auth/credentials.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 写失败的凭据验证测试**

```ts
// tests-next/auth/credentials.test.ts
import { describe, expect, it } from 'vitest';
import { adminCredentialSchema } from '../../modules/auth/credentials';

describe('adminCredentialSchema', () => {
  it('requires a normalized username and long password', () => {
    expect(adminCredentialSchema.parse({ username: ' Owner ', password: 'correct-horse-battery-staple' }).username).toBe('owner');
    expect(() => adminCredentialSchema.parse({ username: 'x', password: 'short' })).toThrow();
  });
});
```

- [ ] **Step 2: 实现 Zod Schema 与 CLI**

```ts
// modules/auth/credentials.ts
import { z } from 'zod';
export const adminCredentialSchema = z.object({
  username: z.string().trim().min(3).max(64).transform((value) => value.toLowerCase()),
  password: z.string().min(16).max(256),
});
```

两个脚本必须使用隐藏输入读取密码，不接受命令行明文密码。`admin-create` 在已有管理员时退出并提示使用 reset；`admin-reset-password` 更新哈希后调用 `deleteAllAdminSessions`。

在 `package.json` 添加：

```json
{
  "admin:create": "tsx scripts/admin-create.ts",
  "admin:reset-password": "tsx scripts/admin-reset-password.ts"
}
```

同时增加可部署脚本构建：

```json
{
  "build": "next build && tsc -p tsconfig.scripts.json",
  "build:scripts": "tsc -p tsconfig.scripts.json"
}
```

```json
// tsconfig.scripts.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist-scripts",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  },
  "include": ["scripts/**/*.ts", "modules/auth/**/*.ts", "server/db/client.ts", "server/repositories/session-repository.ts"]
}
```

生产镜像必须复制 `dist-scripts`，使管理员命令不依赖开发期 tsx。

- [ ] **Step 3: 运行单元测试和 CLI Smoke Test**

Run:

```bash
npx vitest run tests-next/auth/credentials.test.ts
npm run admin:create
```

Expected: 测试 PASS；CLI 交互式创建管理员，数据库只出现一行 `AdminUser`。

- [ ] **Step 4: 验证重复创建被拒绝**

Run: `npm run admin:create`

Expected: 非零退出并显示“管理员已存在”，数据库仍只有一个管理员。

- [ ] **Step 5: Commit（仅当 Git 已初始化）**

```bash
git add scripts modules/auth/credentials.ts tests-next/auth package.json package-lock.json
git commit -m "feat: add admin account commands"
```

### Task 4：登录、退出与限流

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/login/login-form.tsx`
- Create: `server/actions/auth-actions.ts`
- Create: `server/auth/login-rate-limit.ts`
- Create: `tests-next/auth/login-rate-limit.test.ts`
- Create: `tests-next/auth/login-page.test.tsx`

- [ ] **Step 1: 写失败的限流测试**

```ts
// tests-next/auth/login-rate-limit.test.ts
import { describe, expect, it } from 'vitest';
import { isLoginBlocked } from '../../server/auth/login-rate-limit';

describe('login rate limit', () => {
  it('blocks the sixth failure in fifteen minutes', () => {
    const failures = Array.from({ length: 5 }, (_, minute) => new Date(Date.UTC(2026, 8, 19, 12, minute)));
    expect(isLoginBlocked(failures, new Date('2026-09-19T12:10:00Z'))).toBe(true);
    expect(isLoginBlocked(failures, new Date('2026-09-19T12:20:00Z'))).toBe(false);
  });
});
```

- [ ] **Step 2: 实现限流和登录 Action**

`isLoginBlocked` 只统计当前时间前 15 分钟内的失败时间，达到 5 次返回 true。`loginAction` 必须按以下顺序执行：

1. `assertTrustedOrigin((await headers()).get('origin'))`。
2. 解析用户名和密码。
3. 查询最近失败事件；被限流时返回通用错误。
4. 使用 Argon2id 验证密码。
5. 失败时写 `admin_events.action = 'login.failed'`，不区分账号不存在或密码错误。
6. 成功时创建会话，写安全 Cookie，记录 `login.succeeded`，重定向 `/admin`。

`logoutAction` 删除当前会话、清 Cookie 并重定向登录页。

- [ ] **Step 3: 实现可访问登录表单**

表单必须包含用户名、密码、提交中状态、`aria-live` 错误区，并且错误文案统一为“账号或密码不正确”。页面已登录时直接重定向 `/admin`。

- [ ] **Step 4: 运行测试**

Run: `npx vitest run tests-next/auth/login-rate-limit.test.ts tests-next/auth/login-page.test.tsx`

Expected: 限流和表单测试 PASS。

- [ ] **Step 5: 浏览器验证**

Verify：错误密码不泄露账号是否存在；正确密码进入 `/admin`；退出后旧 Cookie 无法再次访问。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add app/admin/login server/actions/auth-actions.ts server/auth/login-rate-limit.ts tests-next/auth
git commit -m "feat: add admin login and logout"
```

### Task 5：旅程输入验证与事务服务

**Files:**
- Create: `modules/journeys/schemas.ts`
- Create: `server/services/journey-service.ts`
- Create: `server/actions/journey-actions.ts`
- Create: `tests-next/journeys/journey-schema.test.ts`

- [ ] **Step 1: 写失败的旅程输入测试**

```ts
// tests-next/journeys/journey-schema.test.ts
import { describe, expect, it } from 'vitest';
import { journeyInputSchema } from '../../modules/journeys/schemas';

const valid = {
  slug: 'porto-2026', city: '波尔图', latinName: 'PORTO', country: '葡萄牙',
  title: '河岸与旧城', description: '一段足够长的旅程描述。', startDate: '2026-05-01', endDate: '2026-05-05',
  latitude: 41.1579, longitude: -8.6291, accent: '#87956c',
  routeStops: [{ name: '里贝拉', visitDate: '2026-05-01' }],
};

describe('journeyInputSchema', () => {
  it('normalizes slugs and accepts valid coordinates', () => {
    expect(journeyInputSchema.parse(valid).slug).toBe('porto-2026');
  });
  it('rejects an end date before the start and invalid coordinates', () => {
    expect(() => journeyInputSchema.parse({ ...valid, endDate: '2026-04-01' })).toThrow();
    expect(() => journeyInputSchema.parse({ ...valid, latitude: 100 })).toThrow();
  });
});
```

- [ ] **Step 2: 实现 Zod Schema**

Schema 必须验证：Slug 正则 `^[a-z0-9]+(?:-[a-z0-9]+)*$`、颜色 `^#[0-9a-fA-F]{6}$`、纬度 `-90..90`、经度 `-180..180`、结束日期不早于开始日期、路线至少一站且保持输入顺序。

- [ ] **Step 3: 实现事务服务**

`journey-service.ts` 导出：

```ts
export async function createJourney(input: JourneyInput, adminId: string): Promise<string>;
export async function updateJourney(id: string, input: JourneyInput, adminId: string): Promise<void>;
export async function publishJourney(id: string, adminId: string): Promise<void>;
export async function archiveJourney(id: string, adminId: string): Promise<void>;
```

创建和更新必须在同一事务内写 Journey、替换 RouteStop、保证 Album 存在并记录 AdminEvent。发布前要求路线非空；归档不删除照片。

- [ ] **Step 4: 实现 Server Actions**

每个 Action 必须调用 `assertTrustedOrigin`、`requireAdminForMutation`、Zod parse、领域服务和 `revalidatePath`。重复 Slug 转换为字段错误，不将 Prisma 错误直接显示给用户。

- [ ] **Step 5: 运行测试和类型检查**

Run: `npx vitest run tests-next/journeys/journey-schema.test.ts && npm run typecheck`

Expected: 测试 PASS，类型检查无错误。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add modules/journeys server/services server/actions/journey-actions.ts tests-next/journeys
git commit -m "feat: add journey mutation service"
```

### Task 6：管理端旅程列表与编辑页

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/trips/new/page.tsx`
- Create: `app/admin/trips/[id]/page.tsx`
- Create: `app/admin/trips/[id]/preview/page.tsx`
- Create: `components/admin/journey-form/journey-form.tsx`
- Create: `components/admin/journey-form/route-stop-editor.tsx`
- Create: `tests-next/admin/journey-form.test.tsx`

- [ ] **Step 1: 写失败的表单可访问性测试**

测试必须渲染表单并断言城市、Slug、日期、坐标、路线字段具有 label；新增与删除路线按钮具有明确名称；错误摘要使用 `role="alert"`。

- [ ] **Step 2: 实现受保护布局与列表**

`app/admin/layout.tsx` 调用 `requireAdmin()`。列表显示草稿、已发布、已归档状态，提供“新建旅程”和编辑链接；不在公开布局添加后台入口。

- [ ] **Step 3: 实现编辑表单**

表单使用 `useActionState`，支持动态路线、字段级错误、未保存离开提醒、保存草稿、保存更新、发布和归档。已发布内容只有提交成功后才改变公开页面。

- [ ] **Step 4: 添加预览路径**

`/admin/trips/[id]/preview` 必须调用 `requireAdmin()`，渲染草稿内容并设置 `robots: { index: false, follow: false }`。

- [ ] **Step 5: 运行测试与浏览器验收**

Run: `npm run check`

Verify：未登录访问 `/admin` 跳转登录；创建草稿后公开首页不显示；发布后显示；归档后隐藏。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add app/admin components/admin tests-next/admin
git commit -m "feat: add protected journey administration"
```
