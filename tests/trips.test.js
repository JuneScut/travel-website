import test from 'node:test';
import assert from 'node:assert/strict';

import { getAdjacentTrip, getTripById, trips } from '../src/trips.js';

test('provides the four prototype destinations in display order', () => {
  assert.deepEqual(
    trips.map(({ id }) => id),
    ['lisbon', 'kyoto', 'iceland', 'paris'],
  );
});

test('finds a destination by id', () => {
  assert.equal(getTripById('paris').city, '巴黎');
});

test('falls back to Kyoto for an unknown destination', () => {
  assert.equal(getTripById('missing').id, 'kyoto');
});

test('cycles to the next and previous destination', () => {
  assert.equal(getAdjacentTrip('paris', 1).id, 'lisbon');
  assert.equal(getAdjacentTrip('lisbon', -1).id, 'paris');
});

test('provides valid map coordinates for every destination', () => {
  for (const trip of trips) {
    assert.equal(typeof trip.geo?.latitude, 'number', `${trip.id} latitude`);
    assert.equal(typeof trip.geo?.longitude, 'number', `${trip.id} longitude`);
    assert.ok(trip.geo.latitude >= -90 && trip.geo.latitude <= 90, `${trip.id} latitude range`);
    assert.ok(trip.geo.longitude >= -180 && trip.geo.longitude <= 180, `${trip.id} longitude range`);
  }
  assert.deepEqual(getTripById('kyoto').geo, { latitude: 35.0116, longitude: 135.7681 });
});

test('every route station has valid coordinates without changing the album tuple API', () => {
  for (const trip of trips) {
    for (const [name, date, geo] of trip.route) {
      assert.equal(typeof name, 'string');
      assert.match(date, /^\d{2}\.\d{2}$/);
      assert.ok(Number.isFinite(geo.latitude) && Math.abs(geo.latitude) <= 90);
      assert.ok(Number.isFinite(geo.longitude) && Math.abs(geo.longitude) <= 180);
    }
  }
});
