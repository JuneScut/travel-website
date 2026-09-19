# 旅迹 Next.js 与数据库基础 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不删除现有静态原型的前提下，建立可测试的 Next.js、PostgreSQL、Prisma 基础，并让新首页从数据库读取四段旅程。

**Architecture:** 在仓库根目录增加 Next.js App Router，旧原型文件暂时保留为视觉基线。PostgreSQL 通过本地 Compose 运行，Prisma 负责数据模型和迁移；公开首页只通过仓储接口读取已发布旅程。

**Tech Stack:** Node.js 24 LTS、Next.js、React、TypeScript、PostgreSQL、Prisma ORM 7、Vitest、Testing Library、Docker Compose

---

> Git note：当前工作目录没有 `.git`。每个任务末尾的 commit 命令仅在用户初始化 Git 后执行，否则记录测试结果后跳过。

### Task 1：建立 Next.js 与双测试运行器

**Files:**
- Modify: `package.json`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `tests-next/setup.ts`
- Create: `tests-next/config/project-config.test.ts`

- [ ] **Step 1: 写失败的项目配置测试**

```ts
// tests-next/config/project-config.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

describe('Next.js project contract', () => {
  it('defines production and verification scripts', () => {
    expect(pkg.scripts).toMatchObject({
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      typecheck: 'tsc --noEmit',
      'test:legacy': 'node --test tests/*.test.js',
      'test:unit': 'vitest run',
    });
  });

  it('uses Next.js, React and TypeScript', () => {
    expect(pkg.dependencies.next).toBeTruthy();
    expect(pkg.dependencies.react).toBeTruthy();
    expect(pkg.devDependencies.typescript).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run tests-next/config/project-config.test.ts`

Expected: FAIL，因为 Vitest 和 Next.js 尚未安装，或脚本不存在。

- [ ] **Step 3: 安装基础依赖**

Run:

```bash
npm install next@latest react@latest react-dom@latest zod server-only
npm install --save-dev typescript @types/node @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/jest-dom eslint eslint-config-next
```

Expected: `package-lock.json` 更新，安装命令退出码为 0。

- [ ] **Step 4: 更新脚本和配置**

将 `package.json` 的 scripts 设置为：

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test:legacy": "node --test tests/*.test.js",
  "test:unit": "vitest run",
  "test": "npm run test:legacy && npm run test:unit",
  "check": "npm run lint && npm run typecheck && npm test"
}
```

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "prototype"]
}
```

```js
// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores(['.next/**', 'prototype/**', 'coverage/**']),
]);
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests-next/**/*.test.ts', 'tests-next/**/*.test.tsx'],
    clearMocks: true,
    setupFiles: ['tests-next/setup.ts'],
  },
});
```

```ts
// tests-next/setup.ts
import '@testing-library/jest-dom/vitest';
```

所有组件 `.test.tsx` 文件首行添加 `// @vitest-environment jsdom`；纯领域、文件系统和数据库测试继续使用默认 Node 环境。

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '旅迹 JOURNAL',
  description: '记录旅行路线与沿途光影的个人网站',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

```css
/* app/globals.css */
:root {
  color-scheme: light;
  --paper: #f2efe8;
  --ink: #1d1d19;
  --muted: #77766f;
  --accent: #87956c;
}

* { box-sizing: border-box; }
html { background: var(--paper); color: var(--ink); }
body { margin: 0; min-width: 320px; }
button, input, textarea { font: inherit; }
```

- [ ] **Step 5: 运行新旧测试**

Run: `npm run test:legacy && npm run test:unit && npm run typecheck`

Expected: 旧原型测试 PASS，新配置测试 PASS，TypeScript 无错误。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add package.json package-lock.json app next.config.ts tsconfig.json vitest.config.ts tests-next/config
git commit -m "chore: scaffold next application"
```

### Task 2：定义 PostgreSQL 数据模型与迁移

**Files:**
- Modify: `package.json`
- Create: `prisma/schema.prisma`
- Create: `prisma.config.ts`
- Create: `.env.example`
- Create: `tests-next/schema/prisma-schema.test.ts`

- [ ] **Step 1: 写失败的数据模型契约测试**

```ts
// tests-next/schema/prisma-schema.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');

describe('Prisma schema', () => {
  for (const model of ['AdminUser', 'Session', 'Journey', 'RouteStop', 'Album', 'Photo', 'AdminEvent']) {
    it(`defines ${model}`, () => expect(schema).toContain(`model ${model}`));
  }

  it('defines publication and photo lifecycle enums', () => {
    expect(schema).toContain('enum JourneyStatus');
    expect(schema).toContain('enum PhotoStatus');
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run tests-next/schema/prisma-schema.test.ts`

Expected: FAIL，`prisma/schema.prisma` 不存在。

- [ ] **Step 3: 安装 Prisma 7 与 PostgreSQL 驱动**

Run:

```bash
npm install @prisma/client@7 @prisma/adapter-pg@7 pg
npm install --save-dev prisma@7 @types/pg tsx
```

Expected: 安装成功且 lockfile 固定具体版本。

- [ ] **Step 4: 创建完整 Schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum JourneyStatus { draft published archived }
enum PhotoStatus { processing ready trashed failed }

model AdminUser {
  id           String       @id @default(uuid()) @db.Uuid
  username     String       @unique
  passwordHash String
  enabled      Boolean      @default(true)
  sessions     Session[]
  events       AdminEvent[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
}

model Session {
  id           String    @id @default(uuid()) @db.Uuid
  adminId      String    @db.Uuid
  tokenHash    String    @unique
  expiresAt    DateTime
  lastActiveAt DateTime  @default(now())
  admin        AdminUser @relation(fields: [adminId], references: [id], onDelete: Cascade)
  createdAt    DateTime  @default(now())

  @@index([adminId, expiresAt])
}

model Journey {
  id          String        @id @default(uuid()) @db.Uuid
  slug        String        @unique
  city        String
  latinName   String
  country     String
  title       String
  description String
  startDate   DateTime      @db.Date
  endDate     DateTime      @db.Date
  latitude    Float
  longitude   Float
  accent      String
  status      JourneyStatus @default(draft)
  sortOrder   Int           @default(0)
  publishedAt DateTime?
  routeStops  RouteStop[]
  album       Album?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([status, sortOrder])
}

model RouteStop {
  id        String   @id @default(uuid()) @db.Uuid
  journeyId String   @db.Uuid
  name      String
  visitDate DateTime? @db.Date
  latitude  Float?
  longitude Float?
  sortOrder Int
  journey   Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)

  @@index([journeyId, sortOrder])
}

model Album {
  id           String  @id @default(uuid()) @db.Uuid
  journeyId    String  @unique @db.Uuid
  title        String
  coverPhotoId String? @db.Uuid
  journey      Journey @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  photos       Photo[] @relation("AlbumPhotos")
  coverPhoto   Photo?  @relation("AlbumCover", fields: [coverPhotoId], references: [id], onDelete: SetNull)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Photo {
  id               String      @id @default(uuid()) @db.Uuid
  albumId          String      @db.Uuid
  storageKey       String      @unique
  originalFilename String
  originalExt      String
  mimeType         String
  byteSize         Int
  width            Int
  height           Int
  mediaVersion     Int         @default(1)
  title            String
  altText          String
  focalX           Float       @default(0.5)
  focalY           Float       @default(0.5)
  sortOrder        Int
  status           PhotoStatus @default(processing)
  trashedAt        DateTime?
  album            Album       @relation("AlbumPhotos", fields: [albumId], references: [id], onDelete: Cascade)
  coverFor         Album[]     @relation("AlbumCover")
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  @@index([albumId, status, sortOrder])
}

model AdminEvent {
  id           String     @id @default(uuid()) @db.Uuid
  adminId      String?    @db.Uuid
  action       String
  resourceType String?
  resourceId   String?
  context      Json?
  admin        AdminUser? @relation(fields: [adminId], references: [id], onDelete: SetNull)
  createdAt    DateTime   @default(now())

  @@index([action, createdAt])
}
```

`.env.example`：

```dotenv
DATABASE_URL=postgresql://travel:change-me@127.0.0.1:5432/travel_journal
MEDIA_ROOT=/absolute/path/to/.data/media
SESSION_COOKIE_NAME=travel_session
APP_ORIGIN=http://localhost:3000
```

```ts
// prisma.config.ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

- [ ] **Step 5: 验证 Schema**

Run: `npx prisma validate && npx vitest run tests-next/schema/prisma-schema.test.ts`

Expected: Prisma schema valid，测试 PASS。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add package.json package-lock.json prisma prisma.config.ts .env.example tests-next/schema
git commit -m "feat: define travel journal data model"
```

### Task 3：建立本地 PostgreSQL 与首个迁移

**Files:**
- Create: `compose.dev.yaml`
- Create: `.env`
- Create: `prisma/migrations/*/migration.sql`
- Modify: `package.json`

- [ ] **Step 1: 创建开发数据库 Compose 文件**

```yaml
# compose.dev.yaml
services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_DB: travel_journal
      POSTGRES_USER: travel
      POSTGRES_PASSWORD: travel-dev-password
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - travel-dev-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U travel -d travel_journal"]
      interval: 2s
      timeout: 3s
      retries: 20

volumes:
  travel-dev-db:
```

将本地 `.env` 设置为：

```dotenv
DATABASE_URL=postgresql://travel:travel-dev-password@127.0.0.1:5432/travel_journal
MEDIA_ROOT=.data/media
SESSION_COOKIE_NAME=travel_session
APP_ORIGIN=http://localhost:3000
```

- [ ] **Step 2: 启动并检查数据库**

Run:

```bash
docker compose -f compose.dev.yaml up -d
docker compose -f compose.dev.yaml exec postgres pg_isready -U travel -d travel_journal
```

Expected: 输出 `accepting connections`。

- [ ] **Step 3: 生成并应用迁移**

Run: `npx prisma migrate dev --name init`

Expected: 创建 migration SQL，数据库与 Schema 同步。

- [ ] **Step 4: 添加数据库脚本**

```json
{
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "db:generate": "prisma generate"
}
```

- [ ] **Step 5: 在空数据库重放迁移**

Run:

```bash
docker compose -f compose.dev.yaml down -v
docker compose -f compose.dev.yaml up -d --wait
npx prisma migrate deploy
```

Expected: 从空卷成功创建全部表，退出码 0。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add compose.dev.yaml prisma/migrations package.json package-lock.json
git commit -m "feat: add postgres development environment"
```

### Task 4：导入四段原型旅程

**Files:**
- Create: `prisma/seed-data.ts`
- Create: `prisma/seed.ts`
- Create: `tests-next/seed/seed-data.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 写失败的种子数据测试**

```ts
// tests-next/seed/seed-data.test.ts
import { describe, expect, it } from 'vitest';
import { journeySeeds } from '../../prisma/seed-data';

describe('journey seed data', () => {
  it('contains the four prototype journeys', () => {
    expect(journeySeeds.map(({ slug }) => slug)).toEqual(['lisbon', 'kyoto', 'iceland', 'paris']);
  });

  it('contains valid coordinates and ordered routes', () => {
    for (const journey of journeySeeds) {
      expect(journey.latitude).toBeGreaterThanOrEqual(-90);
      expect(journey.latitude).toBeLessThanOrEqual(90);
      expect(journey.longitude).toBeGreaterThanOrEqual(-180);
      expect(journey.longitude).toBeLessThanOrEqual(180);
      expect(journey.routeStops.map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2, 3]);
    }
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run tests-next/seed/seed-data.test.ts`

Expected: FAIL，`prisma/seed-data.ts` 不存在。

- [ ] **Step 3: 创建确定性的种子数据**

`prisma/seed-data.ts` 导出完整的 `journeySeeds`。四个对象必须分别使用：

```ts
export const journeySeeds = [
  {
    slug: 'lisbon', city: '里斯本', latinName: 'LISBON', country: '葡萄牙',
    title: '电车穿过有风的坡道', description: '海风把晾晒的衣物吹得很轻，黄色电车沿着石板路慢慢爬升。',
    startDate: '2026-03-12', endDate: '2026-03-17', latitude: 38.7223, longitude: -9.1393,
    accent: '#87956c', sortOrder: 0,
    routeStops: ['阿尔法玛', '贝伦', '辛特拉', '卡斯凯什'].map((name, sortOrder) => ({ name, sortOrder })),
  },
  {
    slug: 'kyoto', city: '京都', latinName: 'KYOTO', country: '日本',
    title: '雨后的青石路', description: '雨停之后，街灯在潮湿的石板路上留下很长的倒影，城市的声音也慢了下来。',
    startDate: '2026-04-18', endDate: '2026-04-26', latitude: 35.0116, longitude: 135.7681,
    accent: '#b75937', sortOrder: 1,
    routeStops: ['京都', '奈良', '大阪', '东京'].map((name, sortOrder) => ({ name, sortOrder })),
  },
  {
    slug: 'iceland', city: '冰岛', latinName: 'ICELAND', country: '冰岛',
    title: '风把黑沙吹向海面', description: '浪在黑色海岸线上一次次退回去，远处的山藏在低低的云层里。',
    startDate: '2025-02-08', endDate: '2025-02-16', latitude: 64.9631, longitude: -19.0208,
    accent: '#6e8998', sortOrder: 2,
    routeStops: ['雷克雅未克', '维克', '杰古沙龙', '斯奈山'].map((name, sortOrder) => ({ name, sortOrder })),
  },
  {
    slug: 'paris', city: '巴黎', latinName: 'PARIS', country: '法国',
    title: '左岸书店关门以前', description: '傍晚的光落在旧书页上，塞纳河边的人们开始收起一天的脚步。',
    startDate: '2025-10-03', endDate: '2025-10-09', latitude: 48.8566, longitude: 2.3522,
    accent: '#44423d', sortOrder: 3,
    routeStops: ['玛黑区', '蒙马特', '左岸', '圣路易岛'].map((name, sortOrder) => ({ name, sortOrder })),
  },
] as const;
```

- [ ] **Step 4: 实现幂等 Seed**

`prisma/seed.ts` 必须对每个 Slug 使用 `upsert`，写入 `published` 状态、路线和一对一相册；重复执行后仍只有四段旅程。相册标题使用 `${city} · 沿途光影`。

- [ ] **Step 5: 验证 Seed 幂等性**

Run:

```bash
npx tsx prisma/seed.ts
npx tsx prisma/seed.ts
docker compose -f compose.dev.yaml exec postgres psql -U travel -d travel_journal -tAc 'select count(*) from "Journey";'
```

Expected: 查询结果为 `4`。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add prisma/seed-data.ts prisma/seed.ts tests-next/seed package.json package-lock.json
git commit -m "feat: seed prototype journeys"
```

### Task 5：建立只读旅程仓储与新首页

**Files:**
- Create: `modules/journeys/types.ts`
- Create: `modules/journeys/mappers.ts`
- Create: `server/db/client.ts`
- Create: `server/repositories/journey-repository.ts`
- Create: `app/(site)/page.tsx`
- Create: `components/site/journey-index.tsx`
- Create: `tests-next/journeys/journey-repository.test.ts`

- [ ] **Step 1: 写失败的仓储映射测试**

```ts
// tests-next/journeys/journey-repository.test.ts
import { describe, expect, it } from 'vitest';
import { toJourneySummary } from '../../modules/journeys/mappers';

describe('toJourneySummary', () => {
  it('returns a serializable public summary', () => {
    expect(toJourneySummary({
      id: 'id-1', slug: 'kyoto', city: '京都', latinName: 'KYOTO', country: '日本',
      title: '雨后的青石路', description: 'desc', startDate: new Date('2026-04-18T00:00:00Z'),
      endDate: new Date('2026-04-26T00:00:00Z'), latitude: 35.0116, longitude: 135.7681,
      accent: '#b75937', sortOrder: 1,
    })).toMatchObject({ slug: 'kyoto', city: '京都', startDate: '2026-04-18' });
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run tests-next/journeys/journey-repository.test.ts`

Expected: FAIL，映射函数不存在。

- [ ] **Step 3: 定义公共类型和仓储**

```ts
// modules/journeys/types.ts
export type JourneySummary = {
  id: string;
  slug: string;
  city: string;
  latinName: string;
  country: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  latitude: number;
  longitude: number;
  accent: string;
  sortOrder: number;
};
```

```ts
// modules/journeys/mappers.ts
import type { Journey } from '@prisma/client';
import type { JourneySummary } from './types';

export function toJourneySummary(row: Pick<Journey,
  'id' | 'slug' | 'city' | 'latinName' | 'country' | 'title' | 'description' |
  'startDate' | 'endDate' | 'latitude' | 'longitude' | 'accent' | 'sortOrder'>): JourneySummary {
  return {
    ...row,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
  };
}
```

```ts
// server/db/client.ts
import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const createClient = () => new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

```ts
// server/repositories/journey-repository.ts
import 'server-only';
import { toJourneySummary } from '../../modules/journeys/mappers';
import type { JourneySummary } from '../../modules/journeys/types';
import { prisma } from '../db/client';

export async function listPublishedJourneys(): Promise<JourneySummary[]> {
  const rows = await prisma.journey.findMany({
    where: { status: 'published' },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map(toJourneySummary);
}
```

`server/db/client.ts` 必须在开发环境复用 `globalThis` 上的 Prisma Client，生产环境创建单例，避免热更新耗尽连接。

- [ ] **Step 4: 实现新首页的服务端读取**

```tsx
// app/(site)/page.tsx
import { JourneyIndex } from '../../components/site/journey-index';
import { listPublishedJourneys } from '../../server/repositories/journey-repository';

export default async function HomePage() {
  const journeys = await listPublishedJourneys();
  return (
    <main id="main-content">
      <h1 className="sr-only">旅迹 JOURNAL</h1>
      <JourneyIndex journeys={journeys} />
    </main>
  );
}
```

`JourneyIndex` 必须输出四个真实 `<a href="/trips/{slug}">`，显示城市、英文名和日期；本阶段只做可用静态样式，不实现 Shader。

- [ ] **Step 5: 验证仓储和生产构建**

Run: `npx vitest run tests-next/journeys/journey-repository.test.ts && npm run build`

Expected: 测试 PASS，Next.js 生产构建成功。

- [ ] **Step 6: Commit（仅当 Git 已初始化）**

```bash
git add modules server app components tests-next/journeys
git commit -m "feat: render journeys from postgres"
```

### Task 6：Phase 1 浏览器与回归验收

**Files:**
- Modify: `README.md`（不存在则创建）
- Verify: all Phase 1 files

- [ ] **Step 1: 添加本地启动文档**

README 必须包含以下准确命令：

```bash
docker compose -f compose.dev.yaml up -d --wait
npm install
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev
```

- [ ] **Step 2: 运行完整检查**

Run: `npm run check && npm run build`

Expected: lint、typecheck、旧测试、新测试和生产构建全部 PASS。

- [ ] **Step 3: 运行数据库断言**

Run:

```bash
docker compose -f compose.dev.yaml exec postgres psql -U travel -d travel_journal -tAc 'select slug,status from "Journey" order by "sortOrder";'
```

Expected: 顺序输出 `lisbon`、`kyoto`、`iceland`、`paris`，状态均为 `published`。

- [ ] **Step 4: 浏览器 Smoke Test**

Run: `npm run dev`

Verify at `http://localhost:3000/`：页面返回 200、显示四段旅程、四个链接可聚焦、无控制台错误。另开 `http://localhost:4173/` 时旧原型仍可运行并作为视觉对照。

- [ ] **Step 5: Commit（仅当 Git 已初始化）**

```bash
git add README.md
git commit -m "docs: add local development workflow"
```
