import { rm } from 'node:fs/promises';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdmin } from '../../../server/auth';
import { db } from '../../../server/db';
import { AppError } from '../../../server/errors';
import { importPhoto, receiveUpload, type StoredFile } from '../../../server/media';
import { uuid } from '../../../server/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let files: StoredFile[] = [];
  try {
    const admin = await requireAdmin(true);
    const parsed = uuid.safeParse(new URL(request.url).searchParams.get('journeyId'));
    if (!parsed.success) throw new AppError('INVALID_INPUT', '请选择有效的旅程');
    const journey = await db.journey.findUnique({ where: { id: parsed.data }, select: { id: true, deletedAt: true } });
    if (!journey || journey.deletedAt) throw new AppError('NOT_FOUND', '旅程不存在或已删除', 404);
    files = await receiveUpload(request);
    const results: { name: string; ok: boolean; id?: string; error?: string }[] = [];
    for (const file of files) {
      try {
        const id = await importPhoto(parsed.data, file, admin.id);
        results.push({ name: file.filename, ok: true, id });
      } catch (error) {
        results.push({ name: file.filename, ok: false, error: error instanceof AppError ? error.message : '图片处理失败，请重试' });
      }
    }
    if (results.some(item => item.ok)) {
      revalidateTag('journeys', { expire: 0 });
      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/trips/[slug]', 'page');
    }
    return Response.json({ results });
  } catch (error) {
    if (error instanceof AppError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    console.error(JSON.stringify({ event: 'upload_failed', name: error instanceof Error ? error.name : 'unknown' }));
    return Response.json({ error: '上传失败，请稍后重试', code: 'SERVER_ERROR' }, { status: 500 });
  } finally {
    await Promise.allSettled(files.map(file => rm(file.path, { force: true })));
  }
}
