import { getAdjacentTrip, getTripById, trips } from '../trips.js';
import { footprints, getFootprintById } from '../footprints.js';

export const pad = (number) => String(number).padStart(2, '0');
export const titleOf = (trip) => `${trip.city} · ${trip.title}`;
export const coordinates = (geo) => [geo.longitude, geo.latitude];
export const chronologicalTrips = [...trips].sort((a, b) => a.date.localeCompare(b.date));
export const atlasTimeline = [
  ...trips.map((trip) => ({ kind: 'trip', id: trip.id, label: trip.city, date: trip.date.replaceAll('.', '-') })),
  ...footprints.map((foot) => ({ kind: 'foot', id: foot.id, label: foot.name, date: foot.date })),
].sort((a, b) => a.date.localeCompare(b.date));

export function initialJourney() {
  return { tripId: 'kyoto', place: { kind: 'trip', tripId: 'kyoto' }, cameraRevision: 0, cameraSource: 'initial' };
}

export function journeyReducer(state, action) {
  if (action.type !== 'select' && action.type !== 'cycle') return state;
  if (action.type === 'select' && action.place?.kind === 'foot') {
    if (!getFootprintById(action.place.footId)) return state;
    return {
      ...state,
      place: { kind: 'foot', footId: action.place.footId },
      cameraRevision: state.cameraRevision + 1,
      cameraSource: 'map',
    };
  }
  const trip = action.type === 'cycle'
    ? getAdjacentTrip(state.tripId, action.direction)
    : getTripById(action.tripId);
  return {
    tripId: trip.id,
    place: action.place ?? { kind: 'trip', tripId: trip.id },
    cameraRevision: state.cameraRevision + 1,
    cameraSource: action.source ?? 'journey',
  };
}
