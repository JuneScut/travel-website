import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: 'tests-next/e2e', fullyParallel: false, workers: 1, timeout: 60000,
  use: { baseURL: 'http://localhost:3101', headless: true, trace: 'retain-on-failure', launchOptions: { executablePath: existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined } },
  webServer: { command: 'npx next start --hostname 127.0.0.1 --port 3101', url: 'http://localhost:3101/api/health', reuseExistingServer: false, timeout: 60000,
    env: { DATABASE_URL: 'postgresql://journal:journal_dev@127.0.0.1:55439/journal_test', APP_ORIGIN: 'http://localhost:3101', COOKIE_SECURE: 'false', TRUST_PROXY: 'false', MEDIA_ROOT: '.data/media-test', RUNTIME_ROOT: '.data/runtime-test' } },
});
