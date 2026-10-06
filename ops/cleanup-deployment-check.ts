import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from '../server/db';
import { mediaRoot } from '../server/runtime';
import { uuid } from '../server/validation';

const slug = process.argv[2];
const expectedId = process.argv[3];
try {
  if (!slug || !/^deployment-check-[a-z0-9-]+$/.test(slug)) throw new Error('仅允许清理指定的部署验证旅程');
  if (expectedId) uuid.parse(expectedId);
  const journey = await db.journey.findUnique({ where: { slug }, include: { album: { include: { photos: true } } } });
  if (journey) {
    uuid.parse(journey.id);
    if (expectedId && journey.id !== expectedId) throw new Error('验证旅程 ID 不匹配，拒绝清理');
    const ids = [journey.id, ...(journey.album?.photos.map(photo => photo.id) ?? [])];
    await db.$transaction(async tx => {
      await tx.adminEvent.deleteMany({ where: { resourceId: { in: ids } } });
      await tx.journey.delete({ where: { id: journey.id, slug } });
    });
    for (const area of ['live', 'trash']) await rm(join(mediaRoot(), area, 'journeys', journey.id), { recursive: true, force: true });
    console.log('已清理本次部署验证创建的旅程与照片');
  }
} finally { await db.$disconnect(); }
