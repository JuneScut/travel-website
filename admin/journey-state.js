const text = (value) => String(value ?? '').trim();
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function createJourney(values, { id, photos = [] }) {
  const city = text(values.city);
  const title = text(values.title);
  if (!city) throw new Error('请填写目的地名称');
  if (!title) throw new Error('请填写旅程标题');
  if (!isDate(values.startDate) || !isDate(values.endDate)) throw new Error('请选择有效的起止日期');
  if (values.endDate < values.startDate) throw new Error('结束日期不能早于开始日期');
  const short = (date) => date.slice(5).replace('-', '.');
  const stops = text(values.route).split(/[\n,，→]+/).map(text).filter(Boolean);
  return {
    id, city, title,
    latin: text(values.latin).toUpperCase() || city,
    country: text(values.country),
    description: text(values.description),
    date: values.startDate.replaceAll('-', '.'),
    dateRange: `${short(values.startDate)} — ${short(values.endDate)}`,
    shortDate: short(values.startDate),
    accent: '#a95336',
    route: stops.map((name) => [name, short(values.startDate)]),
    gallery: photos.map((photo) => ({
      src: photo.previewUrl,
      alt: `${city}旅行照片：${photo.name}`,
      caption: photo.name.replace(/\.[^.]+$/, ''),
      position: '50% 50%',
    })),
    hero: photos[0]?.previewUrl ?? '',
  };
}

export function removeJourney(journeys, id) {
  const index = journeys.findIndex((trip) => trip.id === id);
  if (index < 0) return { journeys, removed: null, index: -1, nextId: null };
  const remaining = journeys.filter((trip) => trip.id !== id);
  return {
    journeys: remaining,
    removed: journeys[index], index,
    nextId: remaining[Math.min(index, remaining.length - 1)]?.id ?? null,
  };
}

export function restoreJourney(journeys, trip, index) {
  if (journeys.some((item) => item.id === trip.id)) return journeys;
  const restored = [...journeys];
  restored.splice(Math.max(0, Math.min(index, restored.length)), 0, trip);
  return restored;
}
