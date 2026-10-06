import { expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('the public map worker includes its runtime shared-module dependency', () => {
  const root = mkdtempSync(join(tmpdir(), 'journal-public-assets-'));
  try {
    const distribution = join(root, 'node_modules/maplibre-gl/dist');
    mkdirSync(distribution, { recursive: true });
    const worker = 'import { marker } from "./maplibre-gl-shared.mjs";';
    const shared = 'export const marker = "worker dependency";';
    writeFileSync(join(distribution, 'maplibre-gl-worker.mjs'), worker);
    writeFileSync(join(distribution, 'maplibre-gl-shared.mjs'), shared);
    const result = spawnSync(process.execPath, [resolve(import.meta.dirname, '../../ops/prepare-public.mjs')], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, MEDIA_ROOT: join(root, 'media'), RUNTIME_ROOT: join(root, 'runtime') },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(root, 'public/map-worker.js'), 'utf8')).toBe(worker);
    expect(readFileSync(join(root, 'public/maplibre-gl-shared.mjs'), 'utf8')).toBe(shared);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
