import { unstable_cache } from 'next/cache';
import { db } from './db';

export const journeyInclude = { stops: { orderBy: { position: 'asc' as const } }, album: { include: { photos: { orderBy: { position: 'asc' as const } } } } };
export async function adminJourneys() {
  return JSON.parse(JSON.stringify(await db.journey.findMany({ include: journeyInclude, orderBy: { position: 'asc' } })));
}
async function loadPublished() {
  const rows = await db.journey.findMany({ where: { status: 'published', deletedAt: null }, include: journeyInclude, orderBy: { position: 'asc' } });
  return rows.map(toPublicTrip);
}
export const publicJourneys = unstable_cache(loadPublished, ['published-journeys'], { tags: ['journeys'], revalidate: 3600 });
export async function publicJourney(slug: string) {
  const rows = await publicJourneys();
  return rows.find(trip => trip.slug === slug) ?? null;
}
export function toPublicTrip(row: Awaited<ReturnType<typeof db.journey.findMany>>[number] & { stops: { name: string; date: Date; latitude: number | null; longitude: number | null }[]; album: { coverPhotoId: string | null; photos: { id: string; status: string; mediaKey: string; mediaVersion: number; title: string; alt: string; width: number; height: number; focalX: number; focalY: number }[] } | null }) {
  const date = row.startDate.toISOString().slice(0, 10);
  const end = row.endDate.toISOString().slice(0, 10);
  const short = (value: string) => value.slice(5).replace('-', '.');
  const gallery = (row.album?.photos ?? []).filter(photo => photo.status === 'ready').map(photo => ({
    id: photo.id, src: `/media/${photo.mediaKey}/v${photo.mediaVersion}/display.webp`, large: `/media/${photo.mediaKey}/v${photo.mediaVersion}/large.webp`, thumb: `/media/${photo.mediaKey}/v${photo.mediaVersion}/thumb.webp`,
    caption: photo.title, alt: photo.alt, width: photo.width, height: photo.height, position: `${photo.focalX}% ${photo.focalY}%`,
  }));
  const cover = gallery.find(photo => photo.id === row.album?.coverPhotoId) ?? gallery[0];
  return {
    id: row.id, artKey: row.legacyKey ?? row.id, slug: row.slug, city: row.city, latin: row.latin, country: row.country, title: row.title, description: row.description,
    date: date.replaceAll('-', '.'), dateRange: `${short(date)} — ${short(end)}`, shortDate: short(date), accent: '#e73759',
    geo: row.latitude !== null && row.longitude !== null ? { latitude: row.latitude, longitude: row.longitude } : null,
    route: row.stops.map(stop => [stop.name, short(stop.date.toISOString().slice(0, 10)), stop.latitude !== null && stop.longitude !== null ? { latitude: stop.latitude, longitude: stop.longitude } : null]),
    gallery, hero: cover?.src ?? '/placeholder.svg',
  };
}
