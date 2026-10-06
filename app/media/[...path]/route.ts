import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { db } from '../../../server/db';
import { currentAdmin } from '../../../server/auth';
import { mediaRoot } from '../../../server/runtime';

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const key = path.join('/');
  const match = /^journeys\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/v([1-9]\d*)\/(large|display|thumb)\.webp$/.exec(key);
  if (!match) return new Response(null, { status: 404 });
  const photo = await db.photo.findUnique({ where: { id: match[2] }, include: { album: { include: { journey: true } } } });
  if (!photo || photo.status !== 'ready' || photo.album.journeyId !== match[1] || photo.mediaVersion !== Number(match[3]) || photo.album.journey.deletedAt) return new Response(null, { status: 404 });
  const published = photo.album.journey.status === 'published';
  if (!published && !(await currentAdmin())) return new Response(null, { status: 404 });
  try {
    return new Response(await readFile(join(mediaRoot(), 'live', key)), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': published ? 'public, max-age=31536000, immutable' : 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response(null, { status: 404 }); }
}
