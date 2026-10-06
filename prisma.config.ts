import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx ops/seed.ts' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://journal:journal_dev@127.0.0.1:55439/journal' },
});
