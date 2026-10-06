import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourney, removeJourney, restoreJourney } from '../admin/journey-state.js';

const values = { city: ' 成都 ', latin: 'chengdu', title: '街巷里的散步', country: '中国', startDate: '2026-10-01', endDate: '2026-10-06', route: '宽窄巷子\n人民公园，锦里' };
const create = (id = 'new-1', photos = []) => createJourney(values, { id, photos });

test('creates a complete journey with optional photos and independent identity', () => {
  const trip = create('new-1', [{ name: 'morning.jpg', previewUrl: 'blob:morning' }]);
  assert.equal(trip.city, '成都');
  assert.equal(trip.latin, 'CHENGDU');
  assert.equal(trip.gallery[0].caption, 'morning');
  assert.equal(trip.hero, 'blob:morning');
  assert.equal(trip.date, '2026.10.01');
  assert.equal(trip.dateRange, '10.01 — 10.06');
  assert.deepEqual(trip.route.map(([name]) => name), ['宽窄巷子', '人民公园', '锦里']);
  assert.notEqual(create('new-2').id, trip.id);
});

test('permits a new journey without photos or route stations', () => {
  const trip = createJourney({ ...values, route: '', latin: '' }, { id: 'empty' });
  assert.equal(trip.gallery.length, 0);
  assert.equal(trip.hero, '');
  assert.equal(trip.latin, '成都');
  assert.deepEqual(trip.route, []);
});

test('rejects missing fields, impossible dates and reversed date ranges', () => {
  for (const invalid of [{ city: ' ' }, { title: '' }, { startDate: '2026-02-30' }, { endDate: '2026-09-30' }]) {
    assert.throws(() => createJourney({ ...values, ...invalid }, { id: 'invalid' }));
  }
});

test('deletes the selected journey and selects a remaining neighbor without mutating source', () => {
  const journeys = ['first', 'middle', 'last'].map((id) => create(id));
  const result = removeJourney(journeys, 'middle');
  assert.equal(result.nextId, 'last');
  assert.deepEqual(result.journeys.map(({ id }) => id), ['first', 'last']);
  assert.equal(journeys.length, 3);
  assert.equal(removeJourney(journeys, 'last').nextId, 'middle');
});

test('handles deletion of the final journey and restores the complete record', () => {
  const trip = create('only', [{ name: 'photo.webp', previewUrl: 'blob:photo' }]);
  const result = removeJourney([trip], 'only');
  assert.deepEqual(result.journeys, []);
  assert.equal(result.nextId, null);
  const restored = restoreJourney(result.journeys, result.removed, result.index);
  assert.deepEqual(restored, [trip]);
  assert.equal(restoreJourney(restored, trip, 0), restored);
});
