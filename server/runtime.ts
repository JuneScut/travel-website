import { access, mkdir, statfs } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { AppError } from './errors';

export const mediaRoot = () => resolve(process.env.MEDIA_ROOT ?? '.data/media');
export const runtimeRoot = () => resolve(process.env.RUNTIME_ROOT ?? '.data/runtime');
export async function initStorage() {
  await Promise.all(['staging', 'live', 'trash'].map(dir => mkdir(join(mediaRoot(), dir), { recursive: true })));
  await mkdir(runtimeRoot(), { recursive: true });
}
export async function assertWritable() {
  let maintenance = false;
  try { await access(join(runtimeRoot(), 'read-only')); maintenance = true; } catch { /* no flag */ }
  if (maintenance) throw new AppError('READ_ONLY', '正在备份或维护，请稍后保存', 503);
}
export async function diskUsage() {
  const stats = await statfs(mediaRoot());
  return stats.blocks ? Math.round((1 - stats.bavail / stats.blocks) * 100) : 0;
}
export async function assertUploadSpace() {
  await assertWritable();
  await initStorage();
  if (await diskUsage() >= 95) throw new AppError('DISK_FULL', '存储空间不足，暂时无法上传照片', 507);
}
