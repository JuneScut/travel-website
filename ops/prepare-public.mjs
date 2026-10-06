import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

await mkdir('public', { recursive: true });
await cp('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/map-worker.js');
for (const dir of ['live', 'trash', 'staging']) await mkdir(join(process.env.MEDIA_ROOT ?? '.data/media', dir), { recursive: true });
await mkdir(process.env.RUNTIME_ROOT ?? '.data/runtime', { recursive: true });
await writeFile('public/placeholder.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1122" height="1402" viewBox="0 0 1122 1402"><rect width="1122" height="1402" fill="#ddef7d"/><path d="M0 1000 Q300 600 600 950 T1122 800 V1402 H0" fill="#254837" opacity=".18"/><text x="561" y="680" text-anchor="middle" fill="#254837" font-size="36">JOURNAL · 旅途待记录</text></svg>');
