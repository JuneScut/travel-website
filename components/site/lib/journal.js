export const pad = (number) => String(number).padStart(2, '0');
export const titleOf = trip => `${trip.city} · ${trip.title}`;
export const coordinates = geo => [geo.longitude, geo.latitude];
