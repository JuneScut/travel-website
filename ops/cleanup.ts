import 'dotenv/config';
import { db } from '../server/db';
import { assertWritable, mediaRoot } from '../server/runtime';
import { movePhotoStorage } from '../server/media';
import { join } from 'node:path';
import { readdir, stat, rm } from 'node:fs/promises';

try {
  await assertWritable();
  const expired = new Date(Date.now() - 30 * 86400000);
  const journeys = await db.journey.findMany({ where: { deletedAt: { lt: expired } }, include: { album: { include: { photos: true } } } });
  for (const journey of journeys) {
    for (const root of ['live', 'trash']) await rm(join(mediaRoot(), root, 'journeys', journey.id), { recursive: true, force: true });
    await db.journey.delete({ where: { id: journey.id } });
  }
  const photos = await db.photo.findMany({ where: { status: 'trashed' } });
  for (const photo of photos) {
    if (photo.deletedAt && photo.deletedAt < expired) {
      for (const root of ['live', 'trash']) await rm(join(mediaRoot(), root, photo.mediaKey), { recursive: true, force: true });
      await db.photo.delete({ where: { id: photo.id } });
    } else await movePhotoStorage(photo.mediaKey, 'trash');
  }
  for (const name of await readdir(join(mediaRoot(), 'staging'))) {
    const path = join(mediaRoot(), 'staging', name);
    if ((await stat(path)).mtimeMs < Date.now() - 86400000) await rm(path, { recursive: true, force: true });
  }
  const stale = await db.photo.findMany({ where: { status: { in: ['processing', 'failed'] }, createdAt: { lt: new Date(Date.now() - 86400000) } } });
  for (const photo of stale) { await rm(join(mediaRoot(), 'live', photo.mediaKey), { recursive: true, force: true }); await db.photo.delete({ where: { id: photo.id } }); }
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400000) } } });
  console.log('回收区与临时上传已清理');
} finally { await db.$disconnect(); }
