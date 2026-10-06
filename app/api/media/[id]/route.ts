import { db } from '../../../../server/db';
import { requireAdmin } from '../../../../server/auth';
import { mediaRoot } from '../../../../server/runtime';
import { AppError } from '../../../../server/errors';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { uuid } from '../../../../server/validation';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params; uuid.parse(id);
    const photo = await db.photo.findUnique({ where: { id } });
    if (!photo || !['ready', 'trashed'].includes(photo.status)) return new Response(null, { status: 404 });
    const path = join(mediaRoot(), photo.status === 'trashed' ? 'trash' : 'live', photo.mediaKey, `original.${photo.originalExt}`);
    return new Response(await readFile(path), { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="photo.${photo.originalExt}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return new Response(null, { status: error instanceof AppError ? error.status : 404 }); }
}
