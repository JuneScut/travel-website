import { randomUUID } from 'node:crypto';
import { access, copyFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import busboy from 'busboy';
import sharp from 'sharp';
import { db } from './db';
import { AppError } from './errors';
import { mediaRoot, initStorage, assertUploadSpace } from './runtime';

export const maxPhotoBytes = 30 * 1024 * 1024;
const formats: Record<string, { mime: string; ext: string }> = { jpeg: { mime: 'image/jpeg', ext: 'jpg' }, png: { mime: 'image/png', ext: 'png' }, webp: { mime: 'image/webp', ext: 'webp' }, avif: { mime: 'image/avif', ext: 'avif' }, heif: { mime: 'image/avif', ext: 'avif' } };
export function imageSignature(buffer: Buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12))) return 'image/avif';
  throw new AppError('INVALID_IMAGE', '仅支持真实的 JPG、PNG、WebP、AVIF 图片');
}
export function safeMediaKey(key: string) {
  if (!/^journeys\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(key)) throw new AppError('INVALID_PATH', '媒体路径无效', 404);
  return key;
}
async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
export async function movePhotoStorage(key: string, target: 'trash' | 'live') {
  safeMediaKey(key);
  const from = join(mediaRoot(), target === 'trash' ? 'live' : 'trash', key);
  const to = join(mediaRoot(), target, key);
  if (!(await exists(from)) && await exists(to)) return;
  await mkdir(dirname(to), { recursive: true });
  try { await rename(from, to); }
  catch { throw new AppError('MEDIA_MOVE_FAILED', '文件移动未完成，请重试；照片尚未公开', 503); }
}

export type StoredFile = { path: string; filename: string; mime: string; error?: string };
export async function receiveUpload(request: Request): Promise<StoredFile[]> {
  await assertUploadSpace();
  if (!request.body) throw new AppError('EMPTY_UPLOAD', '请选择照片');
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 151 * 1024 * 1024) throw new AppError('UPLOAD_LIMIT', '每批最多 5 张，单张不超过 30 MB', 413);
  const files: StoredFile[] = [];
  const jobs: Promise<void>[] = [];
  const parser = busboy({ headers: Object.fromEntries(request.headers), limits: { files: 5, fileSize: maxPhotoBytes, fields: 0, parts: 5 } });
  let rejected = false;
  parser.on('filesLimit', () => { rejected = true; });
  parser.on('partsLimit', () => { rejected = true; });
  parser.on('fieldsLimit', () => { rejected = true; });
  parser.on('file', (_name, stream, info) => {
    const file = { path: join(mediaRoot(), 'staging', `${randomUUID()}.upload`), filename: basename(info.filename).slice(0, 200), mime: info.mimeType } as StoredFile;
    files.push(file);
    stream.on('limit', () => { file.error = '单张照片不能超过 30 MB'; });
    jobs.push(pipeline(stream, createWriteStream(file.path, { mode: 0o600 })).catch(() => { file.error = '上传中断，请重新选择照片'; }));
  });
  try {
    const body = Readable.fromWeb(request.body as import('node:stream/web').ReadableStream);
    let total = 0;
    body.on('data', chunk => { total += chunk.length; if (total > 151 * 1024 * 1024) body.destroy(new AppError('UPLOAD_LIMIT', '上传批次过大', 413)); });
    await pipeline(body, parser);
    await Promise.all(jobs);
    if (rejected || !files.length) throw new AppError('UPLOAD_LIMIT', '请选择 1–5 张照片，每张不超过 30 MB', 413);
    return files;
  } catch (error) {
    await Promise.all(jobs);
    await Promise.all(files.map(file => rm(file.path, { force: true })));
    throw error instanceof AppError ? error : new AppError('INVALID_UPLOAD', '上传内容无效或连接中断');
  }
}

export async function importPhoto(journeyId: string, file: StoredFile, adminId: string | null = null, caption?: { title: string; alt: string; focalX?: number; focalY?: number }) {
  await initStorage();
  if (file.error) throw new AppError('INVALID_UPLOAD', file.error);
  const size = (await stat(file.path)).size;
  if (!size || size > maxPhotoBytes) throw new AppError('UPLOAD_LIMIT', '图片为空或超过 30 MB');
  // Only a small header is read for signature verification; Sharp streams the image from disk.
  const handle = await import('node:fs/promises').then(fs => fs.open(file.path, 'r'));
  const header = Buffer.alloc(32);
  try { await handle.read(header, 0, 32, 0); } finally { await handle.close(); }
  const signature = imageSignature(header);
  const metadata = await sharp(file.path, { limitInputPixels: 80000000, failOn: 'error' }).metadata();
  const format = formats[metadata.format ?? ''];
  if (!format || signature !== format.mime || file.mime !== signature || (metadata.pages ?? 1) > 1 || !metadata.width || !metadata.height) throw new AppError('INVALID_IMAGE', '文件类型不匹配或图片无法处理，不支持动画图片');
  const album = await db.album.findUnique({ where: { journeyId }, include: { journey: true } });
  if (!album || album.journey.deletedAt) throw new AppError('NOT_FOUND', '旅程不存在或已删除');
  const id = randomUUID();
  const key = `journeys/${journeyId}/${id}`;
  const stage = join(mediaRoot(), 'staging', id);
  const destination = join(mediaRoot(), 'live', key);
  const versionDir = join(stage, 'v1');
  await mkdir(versionDir, { recursive: true });
  try {
    await db.photo.create({ data: { id, albumId: album.id, mediaKey: key, originalName: file.filename, originalExt: format.ext, width: metadata.width, height: metadata.height,
      title: caption?.title ?? (file.filename.replace(/\.[^.]+$/, '').slice(0, 160) || '旅行照片'), alt: caption?.alt ?? `${album.journey.city}旅行照片`,
      focalX: caption?.focalX ?? 50, focalY: caption?.focalY ?? 50, position: -1 } });
    await copyFile(file.path, join(stage, `original.${format.ext}`));
    for (const [name, edge] of [['large', 2560], ['display', 1600], ['thumb', 640]] as const) {
      await sharp(file.path, { limitInputPixels: 80000000 }).rotate().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(join(versionDir, `${name}.webp`));
    }
    const dimensions = await sharp(join(versionDir, 'display.webp')).metadata();
    await mkdir(dirname(destination), { recursive: true });
    await rename(stage, destination);
    await db.$transaction(async tx => {
      const updated = await tx.journey.updateMany({ where: { id: journeyId, deletedAt: null }, data: { revision: { increment: 1 } } });
      if (!updated.count) throw new AppError('DELETED', '旅程已删除，照片未上传');
      const max = await tx.photo.aggregate({ where: { albumId: album.id, status: 'ready' }, _max: { position: true } });
      await tx.photo.update({ where: { id }, data: { status: 'ready', width: dimensions.width!, height: dimensions.height!, position: (max._max.position ?? -1) + 1 } });
      await tx.album.updateMany({ where: { id: album.id, coverPhotoId: null }, data: { coverPhotoId: id } });
      await tx.adminEvent.create({ data: { adminId, action: 'photo.upload', resourceType: 'photo', resourceId: id } });
    });
    return id;
  } catch (error) {
    await db.photo.updateMany({ where: { id }, data: { status: 'failed' } });
    await Promise.all([rm(stage, { recursive: true, force: true }), rm(destination, { recursive: true, force: true })]);
    throw error;
  }
}
