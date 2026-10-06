import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const lat = z.number().finite().min(-90).max(90).nullable();
const lon = z.number().finite().min(-180).max(180).nullable();
export const uuid = z.string().uuid();
export const journeyInput = z.object({
  slug: text(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  city: text(80).min(1), latin: text(80), country: text(80), title: text(160).min(1), description: text(4000),
  startDate: date, endDate: date, latitude: lat, longitude: lon,
  stops: z.array(z.object({ name: text(120).min(1), date, latitude: lat, longitude: lon })).max(100),
}).refine(value => value.endDate >= value.startDate, '结束日期不能早于开始日期')
  .refine(value => (value.latitude === null) === (value.longitude === null), '请同时填写经纬度')
  .refine(value => value.stops.every(stop => (stop.latitude === null) === (stop.longitude === null) && stop.date >= value.startDate && stop.date <= value.endDate), '站点日期和坐标无效');
export type JourneyInput = z.infer<typeof journeyInput>;
export const albumInput = z.object({
  revision: z.number().int().positive(),
  coverPhotoId: uuid.nullable(),
  photos: z.array(z.object({ id: uuid, title: text(160).min(1), alt: text(500).min(1), focalX: z.number().min(0).max(100), focalY: z.number().min(0).max(100) })).max(2000),
});
