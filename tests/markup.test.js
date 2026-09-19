import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loadMarkup = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const loadStyles = () => readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('exposes the core travel and gallery regions', () => {
  const html = loadMarkup();
  for (const id of ['main-content', 'trip-selector', 'trip-content', 'gallery']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('provides accessible overlays and a skip link', () => {
  const html = loadMarkup();
  assert.match(html, /href="#main-content"/);
  assert.match(html, /<dialog[^>]+id="lightbox"/);
});

test('keeps editing controls out of the public homepage', () => {
  const html = loadMarkup();
  for (const token of ['open-add-trip', 'add-trip-dialog', '添加旅程', 'href="/admin/"']) {
    assert.doesNotMatch(html, new RegExp(token));
  }
});

test('does not include the deferred essay navigation', () => {
  assert.doesNotMatch(loadMarkup(), />\s*随笔\s*</);
});

test('starts with the journey index without the removed masthead and manifesto', () => {
  const html = loadMarkup();
  for (const token of ['site-header', 'hero-copy', 'hero-title', 'class="stats"']) {
    assert.doesNotMatch(html, new RegExp(token));
  }
  assert.match(html, /<section class="journey-index-section shell"[^>]+aria-labelledby="trip-index-title"/);
});

test('places an accessible world footprint map after the gallery', () => {
  const html = loadMarkup();
  for (const id of ['world-map', 'world-map-title', 'map-markers']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /<svg[^>]+class="world-map-art"[^>]+aria-hidden="true"/s);
  assert.ok(html.indexOf('id="gallery"') < html.indexOf('id="world-map"'));
  assert.ok(html.indexOf('id="world-map"') < html.indexOf('<footer'));
});

test('loads the application as an ES module', () => {
  assert.match(loadMarkup(), /<script type="module" src="\.\/src\/app\.js\?v=world-map-2"><\/script>/);
});

test('versions the map stylesheet for reliable prototype refreshes', () => {
  assert.match(loadMarkup(), /<link rel="stylesheet" href="\.\/styles\.css\?v=world-map-3"/);
});

test('keeps the destination index inside the mobile viewport', () => {
  const css = loadStyles();
  assert.match(css, /\.trip-index\s*{[^}]*min-width:\s*0;/s);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*?\.trip-selector\s*{[^}]*margin:\s*0;/);
});

test('keeps the selected map marker calm rather than continuously pulsing', () => {
  assert.doesNotMatch(loadStyles(), /map-pulse/);
});
