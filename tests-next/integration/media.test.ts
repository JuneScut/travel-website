import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { db } from '../../server/db';
import { importPhoto, movePhotoStorage } from '../../server/media';
import { initStorage, mediaRoot, assertWritable, runtimeRoot } from '../../server/runtime';

if (!process.env.DATABASE_URL?.includes('/journal_test')) throw new Error('数据库集成测试只能运行在 journal_test');
after(async () => { await db.$disconnect(); });
test('maintenance flag blocks mutations and uploads until removed', async () => {
  await initStorage();
  const flag = join(runtimeRoot(), 'read-only');
  try { await writeFile(flag, 'backup'); await assert.rejects(assertWritable, /正在备份/); }
  finally { await rm(flag, { force: true }); }
  await assertWritable();
});
test('real PostgreSQL rollback and image processing, trash and restore', async () => {
  await initStorage();
  const row = await db.journey.create({ data: { slug: 'integration-image', city: '测试', latin: 'TEST', country: '', title: '集成测试', description: '', startDate: new Date('2026-10-01'), endDate: new Date('2026-10-02'), album: { create: { title: '测试' } } } });
  try {
    const id = await importPhoto(row.id, { path: '.data/e2e-photo.png', filename: '真实照片.png', mime: 'image/png' });
    const photo = await db.photo.findUniqueOrThrow({ where: { id } }); assert.equal(photo.status, 'ready');
    const before = await readFile(join(mediaRoot(), 'live', photo.mediaKey, 'v1/display.webp')); assert.equal((await sharp(before).metadata()).format, 'webp');
    await movePhotoStorage(photo.mediaKey, 'trash'); await movePhotoStorage(photo.mediaKey, 'trash');
    await movePhotoStorage(photo.mediaKey, 'live'); assert.deepEqual(await readFile(join(mediaRoot(), 'live', photo.mediaKey, 'v1/display.webp')), before);
    await assert.rejects(() => importPhoto(row.id, { path: '.data/e2e-photo.png', filename: 'fake.jpg', mime: 'image/jpeg' }));
    await assert.rejects(() => db.$transaction(async tx => { await tx.journey.update({ where: { id: row.id }, data: { title: '不应保存' } }); throw Error('rollback'); }));
    assert.equal((await db.journey.findUniqueOrThrow({ where: { id: row.id } })).title, '集成测试');
  } finally {
    await db.album.updateMany({ where: { journeyId: row.id }, data: { coverPhotoId: null } });
    await db.journey.delete({ where: { id: row.id } }); await rm(join(mediaRoot(), 'live', 'journeys', row.id), { recursive: true, force: true });
  }
});
