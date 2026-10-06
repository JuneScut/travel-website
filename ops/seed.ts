import 'dotenv/config';
import { resolve } from 'node:path';
import { db } from '../server/db';
import { importPhoto } from '../server/media';
import { assertWritable } from '../server/runtime';
import { trips as legacyTrips } from '../src/trips.js';
const trips = legacyTrips as unknown as { id: string; city: string; latin: string; country: string; title: string; description: string; date: string; dateRange: string; geo: { latitude: number; longitude: number }; route: [string, string, { latitude: number; longitude: number }][]; gallery: { src: string; caption: string; alt: string; position: string }[] }[];

// Explicit and idempotent import. Startup never overwrites real content or resurrects deleted journeys.
try {
  await assertWritable();
  for (const [position, trip] of trips.entries()) {
    if (await db.journey.findUnique({ where: { legacyKey: trip.id } })) continue;
    const start = trip.date.replaceAll('.', '-');
    const endShort = trip.dateRange.split('—')[1].trim();
    const end = `${start.slice(0, 4)}-${endShort.replace('.', '-')}`;
    const journey = await db.journey.create({ data: { legacyKey: trip.id, slug: trip.id, city: trip.city, latin: trip.latin, country: trip.country,
      title: trip.title, description: trip.description, startDate: new Date(start), endDate: new Date(end), latitude: trip.geo.latitude, longitude: trip.geo.longitude, position,
      album: { create: { title: trip.city } }, stops: { create: trip.route.map(([name, date, geo], index) => ({ name, date: new Date(`${start.slice(0, 4)}-${String(date).replace('.', '-')}`), latitude: geo.latitude, longitude: geo.longitude, position: index })) } } });
    try {
      for (const photo of trip.gallery) {
        const [focalX, focalY] = photo.position?.split(' ').map(value => Number.parseFloat(value)) ?? [50, 50];
        await importPhoto(journey.id, { path: resolve(photo.src), filename: `${trip.id}.webp`, mime: 'image/webp' }, null, { title: photo.caption, alt: photo.alt, focalX, focalY });
      }
      await db.journey.update({ where: { id: journey.id }, data: { status: 'published' } });
      console.log(`已导入 ${trip.city}`);
    } catch (error) {
      // Leave a visible draft for repair rather than publish incomplete content.
      console.error(`导入 ${trip.city} 失败，保留为草稿`); throw error;
    }
  }
} finally { await db.$disconnect(); }
