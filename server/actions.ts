'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from './db';
import { requireAdmin, login, logout } from './auth';
import { AppError, result } from './errors';
import { journeyInput, albumInput, uuid } from './validation';
import { adminJourneys, journeyInclude } from './queries';
import { movePhotoStorage } from './media';
import type { Prisma } from '../generated/prisma/client';

function invalidate() { updateTag('journeys'); revalidatePath('/'); revalidatePath('/admin'); revalidatePath('/trips/[slug]', 'page'); }
async function audit(tx: Prisma.TransactionClient, adminId: string, action: string, resourceId: string) {
  await tx.adminEvent.create({ data: { adminId, action, resourceType: 'journey', resourceId } });
}
export async function loginAction(_previous: unknown, form: FormData) {
  const response = await result(() => login(String(form.get('username') ?? '').trim(), String(form.get('password') ?? '')));
  if (!response.ok) return response;
  redirect('/admin');
}
export async function logoutAction() { await logout(); redirect('/admin/login'); }
export async function reloadJourneys() { return result(async () => { await requireAdmin(); return adminJourneys(); }); }
export async function saveJourney(id: string | null, revision: number | null, input: unknown) {
  return result(async () => {
    const admin = await requireAdmin(true);
    const values = journeyInput.parse(input);
    const { stops, startDate, endDate, ...fields } = values;
    fields.latin ||= fields.city;
    const saved = await db.$transaction(async tx => {
      const existingSlug = await tx.journey.findUnique({ where: { slug: values.slug } });
      if (existingSlug && existingSlug.id !== id) throw new AppError('DUPLICATE_SLUG', '页面地址已存在，请换一个地址', 409);
      if (id) {
        uuid.parse(id);
        const changed = await tx.journey.updateMany({ where: { id, revision: revision ?? -1, deletedAt: null }, data: { ...fields, startDate: new Date(startDate), endDate: new Date(endDate), revision: { increment: 1 } } });
        if (changed.count !== 1) throw new AppError('CONFLICT', '这段旅程已被修改或删除，请重新载入后再保存', 409);
        await tx.routeStop.deleteMany({ where: { journeyId: id } });
        await tx.routeStop.createMany({ data: stops.map((stop, position) => ({ ...stop, date: new Date(stop.date), journeyId: id, position })) });
        await audit(tx, admin.id, 'journey.update', id);
        return id;
      }
      const max = await tx.journey.aggregate({ _max: { position: true } });
      const row = await tx.journey.create({ data: { ...fields, startDate: new Date(startDate), endDate: new Date(endDate), position: (max._max.position ?? -1) + 1,
        stops: { create: stops.map((stop, position) => ({ ...stop, date: new Date(stop.date), position })) }, album: { create: { title: values.city } } } });
      await audit(tx, admin.id, 'journey.create', row.id);
      return row.id;
    });
    invalidate();
    return { id: saved, journeys: await adminJourneys() };
  });
}
export async function changeJourneyStatus(id: string, revision: number, status: 'published' | 'draft' | 'archived' | 'delete' | 'restore') {
  return result(async () => {
    const admin = await requireAdmin(true); uuid.parse(id);
    if (!['published', 'draft', 'archived', 'delete', 'restore'].includes(status)) throw new AppError('INVALID_INPUT', '旅程状态无效');
    await db.$transaction(async tx => {
      const row = await tx.journey.findUnique({ where: { id } });
      if (!row || row.revision !== revision) throw new AppError('CONFLICT', '旅程已变更，请重新载入', 409);
      if (status === 'restore') {
        if (!row.deletedAt || row.deletedAt.getTime() < Date.now() - 30 * 86400000) throw new AppError('EXPIRED', '这段旅程已超过恢复期限');
      } else if (row.deletedAt) throw new AppError('DELETED', '这段旅程已删除');
      const changed = await tx.journey.updateMany({ where: { id, revision }, data: { revision: { increment: 1 }, ...(status === 'delete' ? { deletedAt: new Date() } : status === 'restore' ? { deletedAt: null } : { status }) } });
      if (!changed.count) throw new AppError('CONFLICT', '旅程已变更，请重新载入后再操作', 409);
      await audit(tx, admin.id, `journey.${status}`, id);
    });
    invalidate(); return adminJourneys();
  });
}
export async function saveAlbum(journeyId: string, input: unknown) {
  return result(async () => {
    const admin = await requireAdmin(true); uuid.parse(journeyId);
    const values = albumInput.parse(input);
    await db.$transaction(async tx => {
      const row = await tx.journey.findUnique({ where: { id: journeyId }, include: journeyInclude });
      if (!row?.album || row.deletedAt) throw new AppError('NOT_FOUND', '旅程不存在');
      const ready = row.album.photos.filter(photo => photo.status === 'ready');
      const ids = new Set(values.photos.map(photo => photo.id));
      if (ids.size !== values.photos.length || ready.length !== ids.size || ready.some(photo => !ids.has(photo.id)) || (values.coverPhotoId && !ids.has(values.coverPhotoId))) throw new AppError('INVALID_PHOTOS', '相册照片已变更，请重新载入');
      const changed = await tx.journey.updateMany({ where: { id: journeyId, revision: values.revision }, data: { revision: { increment: 1 } } });
      if (!changed.count) throw new AppError('CONFLICT', '相册已变更，请重新载入后再保存', 409);
      for (const [position, photo] of values.photos.entries()) await tx.photo.update({ where: { id: photo.id }, data: { title: photo.title, alt: photo.alt, focalX: photo.focalX, focalY: photo.focalY, position } });
      await tx.album.update({ where: { id: row.album.id }, data: { coverPhotoId: values.coverPhotoId } });
      await audit(tx, admin.id, 'album.update', journeyId);
    });
    invalidate(); return adminJourneys();
  });
}
export async function changePhotoStatus(id: string, action: 'delete' | 'restore') {
  return result(async () => {
    const admin = await requireAdmin(true); uuid.parse(id);
    if (!['delete', 'restore'].includes(action)) throw new AppError('INVALID_INPUT', '照片操作无效');
    const photo = await db.photo.findUnique({ where: { id }, include: { album: { include: { journey: true } } } });
    if (!photo || photo.album.journey.deletedAt) throw new AppError('NOT_FOUND', '照片不存在');
    if (action === 'restore' && (!photo.deletedAt || photo.deletedAt.getTime() < Date.now() - 30 * 86400000)) throw new AppError('EXPIRED', '照片已超过恢复期限');
    // Hide the image before moving files; an interrupted move remains recoverable/retryable.
    if (action === 'delete') {
      await db.$transaction(async tx => {
        await tx.photo.update({ where: { id }, data: { status: 'trashed', deletedAt: photo.deletedAt ?? new Date() } });
        const next = await tx.photo.findFirst({ where: { albumId: photo.albumId, status: 'ready' }, orderBy: { position: 'asc' } });
        if (photo.album.coverPhotoId === id) await tx.album.update({ where: { id: photo.albumId }, data: { coverPhotoId: next?.id ?? null } });
        await tx.journey.update({ where: { id: photo.album.journeyId }, data: { revision: { increment: 1 } } });
        await audit(tx, admin.id, 'photo.delete', id);
      });
      invalidate();
    }
    await movePhotoStorage(photo.mediaKey, action === 'delete' ? 'trash' : 'live');
    if (action === 'restore') {
      await db.$transaction(async tx => {
        await tx.photo.update({ where: { id }, data: { status: 'ready', deletedAt: null } });
        await tx.journey.update({ where: { id: photo.album.journeyId }, data: { revision: { increment: 1 } } });
        if (!photo.album.coverPhotoId) await tx.album.update({ where: { id: photo.albumId }, data: { coverPhotoId: id } });
        await audit(tx, admin.id, 'photo.restore', id);
      });
      invalidate();
    }
    return adminJourneys();
  });
}
