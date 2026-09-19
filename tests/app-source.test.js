import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loadSource = () => readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

test('versions the trip data import with the map release', () => {
  assert.match(loadSource(), /from '\.\/trips\.js\?v=world-map-2'/);
});

test('supports pointer, click, and keyboard destination selection', () => {
  const source = loadSource();
  for (const eventName of ['pointerenter', 'pointerleave', 'click', 'keydown']) {
    assert.match(source, new RegExp(eventName));
  }
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
});

test('renders the selected trip and exposes its pressed state', () => {
  const source = loadSource();
  assert.match(source, /function renderTrip/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /renderGallery/);
});

test('supports an accessible gallery lightbox', () => {
  const source = loadSource();
  assert.match(source, /function openLightbox/);
  assert.match(source, /showModal/);
  assert.match(source, /close-lightbox/);
  assert.match(source, /previous-photo/);
  assert.match(source, /next-photo/);
  assert.match(source, /Escape/);
});

test('keeps admin behavior out of the public homepage script', () => {
  const source = loadSource();
  assert.doesNotMatch(source, /open-add-trip/);
  assert.doesNotMatch(source, /close-add-trip/);
  assert.doesNotMatch(source, /addTripDialog/);
  assert.doesNotMatch(source, /openAddTripButton/);
});

test('renders projected map markers and synchronizes the selected journey', () => {
  const source = loadSource();
  assert.match(source, /function projectGeoPoint/);
  assert.match(source, /function renderMapMarkers/);
  assert.match(source, /data-map-trip-id/);
  assert.match(source, /function updateMapState/);
  assert.match(source, /mapMarkers\.querySelectorAll/);
});

test('map selection reuses trip selection and scrolls to details with reduced motion support', () => {
  const source = loadSource();
  assert.match(source, /mapMarker\.addEventListener\('click'/);
  assert.match(source, /selectTrip\(tripId/);
  assert.match(source, /footprints\.scrollIntoView/);
  assert.match(source, /behavior:\s*reduceMotion\s*\?\s*'auto'\s*:\s*'smooth'/);
});
