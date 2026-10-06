import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasTimeline, initialJourney, journeyReducer } from '../src/lib/journal.js';
import { greatCircle, paintStyle } from '../src/lib/map-style.js';

test('the latest selection owns the journey, place and camera together', () => {
  const state = ['lisbon', 'iceland', 'paris', 'kyoto'].reduce((state, tripId) => journeyReducer(state, { type: 'select', tripId }), initialJourney());
  assert.equal(state.tripId, 'kyoto');
  assert.deepEqual(state.place, { kind: 'trip', tripId: 'kyoto' });
  assert.equal(state.cameraRevision, 4);
});

test('map station selection highlights that station, including within the same trip', () => {
  const state = journeyReducer(initialJourney(), { type: 'select', tripId: 'kyoto', place: { kind: 'stop', tripId: 'kyoto', stop: 2 }, source: 'map' });
  assert.equal(state.tripId, 'kyoto');
  assert.equal(state.place.stop, 2);
  assert.equal(state.cameraSource, 'map');
  const next = journeyReducer(state, { type: 'cycle', direction: 1 });
  assert.equal(next.tripId, 'iceland');
  assert.equal(next.place.kind, 'trip');
});

test('cycle wraps and always clears a station anchor', () => {
  const state = journeyReducer(initialJourney(), { type: 'select', tripId: 'paris' });
  assert.equal(journeyReducer(state, { type: 'cycle', direction: 1 }).tripId, 'lisbon');
  assert.equal(journeyReducer({ ...state, tripId: 'lisbon' }, { type: 'cycle', direction: -1 }).tripId, 'paris');
});

test('a footprint moves the map while preserving the current journey and clearing its station', () => {
  const selected = journeyReducer(initialJourney(), { type: 'select', tripId: 'paris', place: { kind: 'stop', tripId: 'paris', stop: 1 }, source: 'map' });
  const foot = journeyReducer(selected, { type: 'select', place: { kind: 'foot', footId: 'shanghai' }, source: 'map' });
  assert.equal(foot.tripId, 'paris');
  assert.deepEqual(foot.place, { kind: 'foot', footId: 'shanghai' });
  assert.equal(foot.cameraSource, 'map');
  assert.equal(foot.cameraRevision, selected.cameraRevision + 1);
  assert.equal(journeyReducer(foot, { type: 'select', place: { kind: 'foot', footId: 'missing' } }), foot);
  const next = journeyReducer(foot, { type: 'cycle', direction: 1 });
  assert.equal(next.tripId, 'lisbon');
  assert.deepEqual(next.place, { kind: 'trip', tripId: 'lisbon' });
});

test('the atlas timeline orders footprints and album journeys by date', () => {
  assert.deepEqual(atlasTimeline.map(({ id }) => id), ['capetown', 'chiangmai', 'shanghai', 'iceland', 'paris', 'lisbon', 'kyoto']);
});

test('flight interpolation preserves endpoints and finite coordinates', () => {
  const a = [-21.9426, 64.1466], b = [135.7681, 35.0116];
  const path = greatCircle(a, b);
  assert.equal(path.length, 73);
  for (let i = 0; i < 2; i++) {
    assert.ok(Math.abs(path[0][i] - a[i]) < 1e-8);
    assert.ok(Math.abs(path.at(-1)[i] - b[i]) < 1e-8);
  }
  assert.ok(path.flat().every(Number.isFinite));
});

test('the map uses the journal palette and globe projection', () => {
  const result = paintStyle({ layers: [{ id: 'water', type: 'fill' }, { id: 'country_label', type: 'symbol', layout: { 'text-field': 'name' } }, { id: 'poi_shop', type: 'symbol' }] });
  assert.deepEqual(result.projection, { type: 'globe' });
  assert.equal(result.layers[0].paint['fill-color'], '#FFD3E6');
  assert.equal(result.layers.length, 2);
  assert.ok(JSON.stringify(result.layers[1].layout['text-field']).includes('name:zh-Hans'));
});
