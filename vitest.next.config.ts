import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests-next/unit/**/*.test.ts'] } });
